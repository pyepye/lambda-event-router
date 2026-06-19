import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CfnOutput, Duration, RemovalPolicy, Size, Stack, type StackProps } from 'aws-cdk-lib';
import { Stream, StreamMode } from 'aws-cdk-lib/aws-kinesis';
import {
  DeliveryStream,
  EnableLogging,
  KinesisStreamSource,
  LambdaFunctionProcessor,
  S3Bucket,
} from 'aws-cdk-lib/aws-kinesisfirehose';
import type { IFunction } from 'aws-cdk-lib/aws-lambda';
import { LoggingFormat, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, type NodejsFunctionProps, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

// Long enough that one put of several records reaches the worker as a single invocation. The router's
// per-record results only sit side by side in the log when that happens.
const PROCESSOR_BUFFER_SECONDS = 60;

// Firehose rejects a lambda processor that sets one buffer bound without the other. A run holds a few
// hundred bytes, so the interval is what flushes it.
const PROCESSOR_BUFFER_MIB = 1;

// The shortest buffer dynamic partitioning accepts, so both streams use it. It sets how long a run
// waits for its S3 objects.
const S3_BUFFER_SECONDS = 60;

// Dynamic partitioning will not take a buffer smaller than this. A run never fills it, so the interval
// is what flushes it.
const PARTITIONED_BUFFER_MIB = 64;

const srcDir = fileURLToPath(new URL('../src', import.meta.url));
const entry = join(srcDir, 'index.ts');

const sharedBundling: NodejsFunctionProps['bundling'] = {
  format: OutputFormat.ESM,
  target: 'node22',
  minify: true,
  sourceMap: true,
  mainFields: ['module', 'main'],
  externalModules: [],
  esbuildArgs: { '--conditions': 'module' },
  banner: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
};

// A processor binds to one destination, so each delivery stream gets its own around the same worker.
function transformWith(workerFn: IFunction): LambdaFunctionProcessor {
  return new LambdaFunctionProcessor(workerFn, {
    bufferInterval: Duration.seconds(PROCESSOR_BUFFER_SECONDS),
    bufferSize: Size.mebibytes(PROCESSOR_BUFFER_MIB),
  });
}

export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const landingBucket = new Bucket(this, 'LandingBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // One shard, provisioned. On-demand costs more than twice as much per hour and buys capacity this
    // example never uses.
    const auditEventsStream = new Stream(this, 'AuditEventsStream', {
      streamName: `${this.stackName}-audit-events`,
      streamMode: StreamMode.PROVISIONED,
      shardCount: 1,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // The worker matches the clickstream by this ARN. Building it from the name rather than reading it
    // off the delivery stream is what keeps the worker and the stream from depending on each other.
    const clickstreamName = `${this.stackName}-clickstream`;
    const clickstreamArn = this.formatArn({
      service: 'firehose',
      resource: 'deliverystream',
      resourceName: clickstreamName,
    });

    const auditTrailName = `${this.stackName}-audit-trail`;

    // Owning the log groups keeps `cdk destroy` clean. Left to Lambda and Firehose they outlive the
    // stack.
    const workerLogGroup = new LogGroup(this, 'WorkerLogGroup', {
      logGroupName: `/aws/lambda/${this.stackName}-worker`,
      retention: RetentionDays.ONE_DAY,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const clickstreamLogGroup = new LogGroup(this, 'ClickstreamLogGroup', {
      logGroupName: `/aws/kinesisfirehose/${clickstreamName}`,
      retention: RetentionDays.ONE_DAY,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const auditTrailLogGroup = new LogGroup(this, 'AuditTrailLogGroup', {
      logGroupName: `/aws/kinesisfirehose/${auditTrailName}`,
      retention: RetentionDays.ONE_DAY,
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
        CLICKSTREAM_ARN: clickstreamArn,
        AUDIT_STREAM_ARN: auditEventsStream.streamArn,
      },
      bundling: sharedBundling,
    });

    new DeliveryStream(this, 'Clickstream', {
      deliveryStreamName: clickstreamName,
      destination: new S3Bucket(landingBucket, {
        dataOutputPrefix: 'clicks/',
        errorOutputPrefix: 'errors/clicks/',
        bufferingInterval: Duration.seconds(S3_BUFFER_SECONDS),
        bufferingSize: Size.mebibytes(1),
        processors: [transformWith(workerFn)],
        loggingConfig: new EnableLogging(clickstreamLogGroup),
      }),
    });

    new DeliveryStream(this, 'AuditTrail', {
      deliveryStreamName: auditTrailName,
      source: new KinesisStreamSource(auditEventsStream),
      destination: new S3Bucket(landingBucket, {
        // The tenant id the handler returns as a partition key fills this in.
        dataOutputPrefix: 'audit/tenant=!{partitionKeyFromLambda:tenantId}/',
        errorOutputPrefix: 'errors/audit/',
        bufferingInterval: Duration.seconds(S3_BUFFER_SECONDS),
        bufferingSize: Size.mebibytes(PARTITIONED_BUFFER_MIB),
        dynamicPartitioning: { enabled: true },
        processors: [transformWith(workerFn)],
        loggingConfig: new EnableLogging(auditTrailLogGroup),
      }),
    });

    new CfnOutput(this, 'ClickstreamName', { value: clickstreamName });
    new CfnOutput(this, 'AuditStreamArn', { value: auditEventsStream.streamArn });
    new CfnOutput(this, 'LandingBucketName', { value: landingBucket.bucketName });
  }
}
