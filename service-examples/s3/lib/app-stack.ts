import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { LoggingFormat, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, type NodejsFunctionProps, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { BlockPublicAccess, Bucket, EventType, ObjectOwnership, StorageClass } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import type { Construct } from 'constructs';

// The Glacier restore and the lifecycle rules land hours after the trigger, so the log has to outlive them.
const LOG_RETENTION = RetentionDays.ONE_WEEK;

const srcDir = fileURLToPath(new URL('../src', import.meta.url));
const entry = join(srcDir, 'index.ts');

const sharedBundling: NodejsFunctionProps['bundling'] = {
  format: OutputFormat.ESM,
  target: 'node22',
  minify: true,
  sourceMap: true,
  mainFields: ['module', 'main'],
  externalModules: ['@aws-sdk/*'],
  esbuildArgs: { '--conditions': 'module' },
  banner: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
};

// One configuration per event type, none of them key filtered. S3 rejects a notification set where
// two configurations share an event type and an overlapping key pattern.
const UPLOADS_EVENTS: EventType[] = [
  EventType.OBJECT_CREATED,
  EventType.OBJECT_REMOVED,
  EventType.OBJECT_RESTORE,
  EventType.OBJECT_TAGGING,
  EventType.OBJECT_ACL_PUT,
  EventType.LIFECYCLE_EXPIRATION,
  EventType.LIFECYCLE_TRANSITION,
];

const REPORTS_EVENTS: EventType[] = [EventType.OBJECT_CREATED, EventType.OBJECT_REMOVED];

export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const uploadsBucket = new Bucket(this, 'UploadsBucket', {
      versioned: true,
      // ObjectAcl:Put only fires where ACLs are enabled, which the default BucketOwnerEnforced turns off.
      objectOwnership: ObjectOwnership.OBJECT_WRITER,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [
        {
          id: 'expire-drafts',
          prefix: 'archive/expiring/',
          expiration: Duration.days(1),
          noncurrentVersionExpiration: Duration.days(1),
        },
        {
          id: 'cool-ledgers',
          prefix: 'archive/cooling/',
          transitions: [{ storageClass: StorageClass.GLACIER, transitionAfter: Duration.days(0) }],
        },
      ],
    });

    const reportsBucket = new Bucket(this, 'ReportsBucket', {
      versioned: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Holds the batch manifest, the objects the job works on and the job's completion report. It
    // carries no notification configuration, so the job's own writes cannot feed back into the worker.
    const batchOpsBucket = new Bucket(this, 'BatchOpsBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const workerLogGroup = new LogGroup(this, 'WorkerLogGroup', {
      logGroupName: `/aws/lambda/${this.stackName}-worker`,
      retention: LOG_RETENTION,
      removalPolicy: RemovalPolicy.DESTROY,
    });

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
        UPLOADS_BUCKET: uploadsBucket.bucketName,
        REPORTS_BUCKET: reportsBucket.bucketName,
      },
      bundling: sharedBundling,
    });

    batchOpsBucket.grantRead(workerFn);

    const destination = new LambdaDestination(workerFn);
    for (const event of UPLOADS_EVENTS) {
      uploadsBucket.addEventNotification(event, destination);
    }
    for (const event of REPORTS_EVENTS) {
      reportsBucket.addEventNotification(event, destination);
    }

    const batchJobRole = new Role(this, 'BatchJobRole', {
      assumedBy: new ServicePrincipal('batchoperations.s3.amazonaws.com'),
    });
    workerFn.grantInvoke(batchJobRole);
    batchOpsBucket.grantReadWrite(batchJobRole);

    new CfnOutput(this, 'UploadsBucketName', { value: uploadsBucket.bucketName });
    new CfnOutput(this, 'ReportsBucketName', { value: reportsBucket.bucketName });
    new CfnOutput(this, 'BatchOpsBucketName', { value: batchOpsBucket.bucketName });
    new CfnOutput(this, 'WorkerFunctionArn', { value: workerFn.functionArn });
    new CfnOutput(this, 'BatchJobRoleArn', { value: batchJobRole.roleArn });
  }
}
