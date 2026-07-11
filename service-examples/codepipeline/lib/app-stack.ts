import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { Artifact, Pipeline, PipelineType } from 'aws-cdk-lib/aws-codepipeline';
import { LambdaInvokeAction, S3SourceAction, S3Trigger } from 'aws-cdk-lib/aws-codepipeline-actions';
import { LoggingFormat, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, type NodejsFunctionProps, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

import {
  CANARY_STEP,
  PIPELINE_NAME,
  RECONCILE_STEP,
  RELEASE_BUNDLE_KEY,
  ROLLBACK_STEP,
  VERIFY_STEP,
} from '../src/config.js';

const BUNDLE_NAME = 'checkout-service';
const ENVIRONMENT = 'staging';

const srcDir = fileURLToPath(new URL('../src', import.meta.url));
const entry = join(srcDir, 'index.ts');

const sharedBundling: NodejsFunctionProps['bundling'] = {
  format: OutputFormat.ESM,
  target: 'node22',
  minify: true,
  sourceMap: true,
  mainFields: ['module', 'main'],
  // The CodePipeline and S3 clients are bundled rather than taken from the runtime. The Node 22
  // runtime ships a reduced set of AWS SDK packages, and the CodePipeline client is not in it.
  externalModules: [],
  esbuildArgs: { '--conditions': 'module' },
  banner: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
};

export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Holds the release bundle and the pipeline's own artifacts. CodePipeline needs a versioned
    // bucket for an S3 source.
    const releaseBucket = new Bucket(this, 'ReleaseBucket', {
      versioned: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Both functions write here, so one export command covers the whole run.
    const workerLogGroup = new LogGroup(this, 'WorkerLogGroup', {
      logGroupName: `/aws/lambda/${this.stackName}-worker`,
      retention: RetentionDays.ONE_DAY,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const deployerFunctionName = `${this.stackName}-deployer`;
    const notifierFunctionName = `${this.stackName}-notifier`;

    // One bundle, deployed twice. The functionName filter is what routes a job to the right handler,
    // so the names both functions see have to match the names the pipeline invokes.
    const workerProps = {
      entry,
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      memorySize: 512,
      timeout: Duration.seconds(30),
      // The router reports the job as failed before the handler's error reaches Lambda, so an async
      // retry would only repeat a failure CodePipeline has recorded.
      retryAttempts: 0,
      loggingFormat: LoggingFormat.JSON,
      logGroup: workerLogGroup,
      environment: {
        DEPLOYER_FUNCTION_NAME: deployerFunctionName,
        NOTIFIER_FUNCTION_NAME: notifierFunctionName,
      },
      bundling: sharedBundling,
    } satisfies NodejsFunctionProps;

    const deployerFn = new NodejsFunction(this, 'DeployerFn', {
      ...workerProps,
      functionName: deployerFunctionName,
    });

    const notifierFn = new NodejsFunction(this, 'NotifierFn', {
      ...workerProps,
      functionName: notifierFunctionName,
    });

    const releaseBundle = new Artifact('ReleaseBundle');
    const verificationReport = new Artifact('VerificationReport');

    // S3Trigger.NONE means the only thing that starts a run is the release script. An upload on its
    // own starts nothing, so one run never races another.
    const fetchReleaseBundle = new S3SourceAction({
      actionName: 'FetchReleaseBundle',
      bucket: releaseBucket,
      bucketKey: RELEASE_BUNDLE_KEY,
      trigger: S3Trigger.NONE,
      output: releaseBundle,
    });

    const verifyBundle = new LambdaInvokeAction({
      actionName: 'VerifyBundle',
      lambda: deployerFn,
      inputs: [releaseBundle],
      outputs: [verificationReport],
      variablesNamespace: 'VerifyBundle',
      userParameters: { step: VERIFY_STEP, environment: ENVIRONMENT, bundleName: BUNDLE_NAME },
    });

    const pipeline = new Pipeline(this, 'ReleasePipeline', {
      pipelineName: PIPELINE_NAME,
      pipelineType: PipelineType.V2,
      artifactBucket: releaseBucket,
      stages: [
        { stageName: 'Source', actions: [fetchReleaseBundle] },
        { stageName: 'Verify', actions: [verifyBundle] },
      ],
    });

    pipeline.addStage({
      stageName: 'Deploy',
      actions: [
        new LambdaInvokeAction({
          actionName: 'CanaryDeploy',
          lambda: deployerFn,
          // bundleSha is an output variable of VerifyBundle, so the value the verify handler returned
          // arrives here as UserParameters.
          userParameters: {
            step: CANARY_STEP,
            environment: ENVIRONMENT,
            bundleSha: verifyBundle.variable('bundleSha'),
          },
        }),
        new LambdaInvokeAction({
          actionName: 'AnnounceRelease',
          lambda: notifierFn,
          // Not JSON, so the router hands the handler the raw string rather than an object.
          userParametersString: 'releases',
        }),
      ],
    });

    // Every action here fails, one per failure the router can produce. They share a runOrder, so all
    // three run before the stage gives up.
    pipeline.addStage({
      stageName: 'Recover',
      actions: [
        new LambdaInvokeAction({
          actionName: 'RollbackRelease',
          lambda: deployerFn,
          userParameters: { step: ROLLBACK_STEP, environment: ENVIRONMENT },
        }),
        new LambdaInvokeAction({
          actionName: 'ReconcileLedger',
          lambda: deployerFn,
          // Consuming the verification report proves VerifyBundle uploaded it. A missing output
          // artifact fails this action before the router ever sees the job.
          inputs: [releaseBundle, verificationReport],
          userParameters: { step: RECONCILE_STEP, environment: ENVIRONMENT },
        }),
        new LambdaInvokeAction({
          actionName: 'VerifyRollbackBundle',
          lambda: deployerFn,
          inputs: [releaseBundle],
          // VerifyParametersSchema requires an environment, and this action does not set one.
          userParameters: { step: VERIFY_STEP, bundleName: BUNDLE_NAME },
        }),
      ],
    });

    new CfnOutput(this, 'ReleaseBucketName', { value: releaseBucket.bucketName });
    new CfnOutput(this, 'PipelineName', { value: pipeline.pipelineName });
    new CfnOutput(this, 'WorkerLogGroupName', { value: workerLogGroup.logGroupName });
  }
}
