import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps, Tags } from 'aws-cdk-lib';
import {
  CfnConfigurationRecorder,
  CfnDeliveryChannel,
  CustomRule,
  MaximumExecutionFrequency,
  RuleScope,
} from 'aws-cdk-lib/aws-config';
import { ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Code, Function as LambdaFunction, LoggingFormat, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, type NodejsFunctionProps, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

import {
  COMPLIANCE_SCOPE_TAG,
  DATA_CLASSIFICATION_TAG,
  fleetFunctionName,
  OWNER_TAG,
  RULE_PARAMETERS,
  ruleName,
  type TRule,
} from '../src/config.js';

const srcDir = fileURLToPath(new URL('../src', import.meta.url));
const entry = join(srcDir, 'index.ts');

const sharedBundling: NodejsFunctionProps['bundling'] = {
  format: OutputFormat.ESM,
  target: 'node22',
  minify: true,
  sourceMap: true,
  mainFields: ['module', 'main'],
  // The Node 22 runtime ships a reduced set of AWS SDK packages, so the Config client is bundled.
  externalModules: [],
  esbuildArgs: { '--conditions': 'module' },
  banner: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
};

export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Config needs a delivery channel before it records anything, and a delivery channel needs a
    // bucket. Nothing in this example reads the bucket.
    const deliveryBucket = new Bucket(this, 'DeliveryBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const recorderRole = new Role(this, 'RecorderRole', {
      assumedBy: new ServicePrincipal('config.amazonaws.com'),
      managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('service-role/AWS_ConfigRole')],
    });
    recorderRole.addToPolicy(
      new PolicyStatement({
        actions: ['s3:PutObject', 's3:PutObjectAcl'],
        resources: [deliveryBucket.arnForObjects('*')],
      }),
    );
    recorderRole.addToPolicy(
      new PolicyStatement({
        actions: ['s3:GetBucketAcl'],
        resources: [deliveryBucket.bucketArn],
      }),
    );

    // An account holds one recorder per region. Recording Lambda functions alone keeps the cost to
    // the few functions in the account.
    const recorder = new CfnConfigurationRecorder(this, 'Recorder', {
      name: `${this.stackName}-recorder`,
      roleArn: recorderRole.roleArn,
      recordingGroup: {
        allSupported: false,
        includeGlobalResourceTypes: false,
        resourceTypes: ['AWS::Lambda::Function'],
        recordingStrategy: { useOnly: 'INCLUSION_BY_RESOURCE_TYPES' },
      },
    });

    // The recorder waits for this channel before it can start recording, so neither may depend on the
    // other. CloudFormation creates them side by side.
    const deliveryChannel = new CfnDeliveryChannel(this, 'DeliveryChannel', {
      name: `${this.stackName}-delivery`,
      s3BucketName: deliveryBucket.bucketName,
    });

    // The fleet the change-triggered rules evaluate. Neither function is ever invoked. Without a log
    // group of their own, CDK gives each one a log group that outlives the stack.
    const fleetLogGroup = new LogGroup(this, 'FleetLogGroup', {
      retention: RetentionDays.ONE_DAY,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const checkoutApi = new LambdaFunction(this, 'CheckoutApiFn', {
      functionName: fleetFunctionName(this.stackName, 'checkoutApi'),
      description: 'Takes card payments at checkout',
      runtime: Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: Code.fromInline('exports.handler = async () => ({ statusCode: 200 });'),
      memorySize: 256,
      timeout: Duration.seconds(10),
      logGroup: fleetLogGroup,
    });
    Tags.of(checkoutApi).add(COMPLIANCE_SCOPE_TAG, this.stackName);
    Tags.of(checkoutApi).add(OWNER_TAG, 'payments');

    const reportBuilder = new LambdaFunction(this, 'ReportBuilderFn', {
      functionName: fleetFunctionName(this.stackName, 'reportBuilder'),
      runtime: Runtime.PYTHON_3_12,
      handler: 'index.handler',
      code: Code.fromInline('def handler(event, context):\n    return None\n'),
      memorySize: 2048,
      timeout: Duration.seconds(60),
      logGroup: fleetLogGroup,
    });
    Tags.of(reportBuilder).add(COMPLIANCE_SCOPE_TAG, this.stackName);
    Tags.of(reportBuilder).add(DATA_CLASSIFICATION_TAG, 'confidential');

    const workerLogGroup = new LogGroup(this, 'WorkerLogGroup', {
      logGroupName: `/aws/lambda/${this.stackName}-worker`,
      retention: RetentionDays.ONE_DAY,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Config invokes the worker asynchronously, so Lambda retries a failed evaluation twice.
    const workerFn = new NodejsFunction(this, 'WorkerFn', {
      functionName: `${this.stackName}-worker`,
      entry,
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      memorySize: 512,
      timeout: Duration.seconds(30),
      loggingFormat: LoggingFormat.JSON,
      logGroup: workerLogGroup,
      environment: {
        STACK_NAME: this.stackName,
        ACCOUNT_ID: this.account,
      },
      bundling: sharedBundling,
    });

    const addRule = (rule: TRule, props: Partial<ConstructorParameters<typeof CustomRule>[2]>): void => {
      const configRule = new CustomRule(this, `${rule}Rule`, {
        configRuleName: ruleName(this.stackName, rule),
        lambdaFunction: workerFn,
        ...props,
      });
      // A rule can only be created once a recorder exists, and it only sees resources once recording
      // has started.
      configRule.node.addDependency(recorder, deliveryChannel);
    };

    const change = { configurationChanges: true };
    const inScope = RuleScope.fromTag(COMPLIANCE_SCOPE_TAG, this.stackName);
    const owned = RuleScope.fromTag(OWNER_TAG);
    const confidential = RuleScope.fromTag(DATA_CLASSIFICATION_TAG, 'confidential');

    addRule('approvedRuntime', { ...change, ruleScope: inScope, inputParameters: RULE_PARAMETERS.approvedRuntime });
    addRule('memoryLimit', { ...change, ruleScope: inScope, inputParameters: RULE_PARAMETERS.memoryLimit });
    addRule('serviceCatalogue', { ...change, ruleScope: inScope });
    addRule('timeoutLimit', { ...change, ruleScope: owned, inputParameters: RULE_PARAMETERS.timeoutLimit });
    addRule('onCallRota', { ...change, ruleScope: owned });
    addRule('confidentialTracing', { ...change, ruleScope: confidential });

    // Periodic rules run on creation and when the evaluate script asks. Once a day keeps them quiet
    // otherwise.
    const daily = { periodic: true, maximumExecutionFrequency: MaximumExecutionFrequency.TWENTY_FOUR_HOURS };

    addRule('lambdaInventory', { ...daily, inputParameters: RULE_PARAMETERS.lambdaInventory });
    addRule('idleFunctionSweep', { ...daily, inputParameters: RULE_PARAMETERS.idleFunctionSweep });
    addRule('concurrencyHeadroom', daily);
    addRule('costReport', daily);

    new CfnOutput(this, 'DeliveryBucketName', { value: deliveryBucket.bucketName });
    new CfnOutput(this, 'WorkerLogGroupName', { value: workerLogGroup.logGroupName });
  }
}
