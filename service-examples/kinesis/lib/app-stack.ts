import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { Stream, StreamMode } from 'aws-cdk-lib/aws-kinesis';
import { LoggingFormat, Runtime, StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { KinesisEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction, type NodejsFunctionProps, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { Construct } from 'constructs';

const WORKER_BATCH_SIZE = 10;

// Long enough for a group of writes to arrive as one batch, and short enough that the trigger does not
// spend its time waiting on the window.
const WORKER_BATCHING_WINDOW_SECONDS = 2;

// Cap the retries, so a failing batch is discarded rather than held. The default holds the shard until
// the record expires and repeats every error without proving anything new.
const WORKER_RETRY_ATTEMPTS = 1;

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

export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // One shard each, provisioned. On-demand costs more than twice as much per hour and buys capacity
    // this example never uses. A single shard also keeps every record of a run in one ordered lane.
    const ordersStream = new Stream(this, 'OrdersStream', {
      streamName: `${this.stackName}-orders`,
      streamMode: StreamMode.PROVISIONED,
      shardCount: 1,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const telemetryStream = new Stream(this, 'TelemetryStream', {
      streamName: `${this.stackName}-telemetry`,
      streamMode: StreamMode.PROVISIONED,
      shardCount: 1,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Owning the log group keeps `cdk destroy` clean. Left to Lambda it outlives the stack, and the
    // `logRetention` prop reaches it through an extra custom resource lambda instead.
    const workerLogGroup = new LogGroup(this, 'WorkerLogGroup', {
      logGroupName: `/aws/lambda/${this.stackName}-worker`,
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
        ORDERS_STREAM_ARN: ordersStream.streamArn,
        TELEMETRY_STREAM_ARN: telemetryStream.streamArn,
      },
      bundling: sharedBundling,
    });

    // TRIM_HORIZON, so the first trigger after a deploy is not lost. LATEST skips whatever was put
    // before the poller attached to the shard, which on a new stack is most of the first run.
    for (const stream of [ordersStream, telemetryStream]) {
      workerFn.addEventSource(
        new KinesisEventSource(stream, {
          startingPosition: StartingPosition.TRIM_HORIZON,
          batchSize: WORKER_BATCH_SIZE,
          maxBatchingWindow: Duration.seconds(WORKER_BATCHING_WINDOW_SECONDS),
          retryAttempts: WORKER_RETRY_ATTEMPTS,
          reportBatchItemFailures: true,
        }),
      );
    }

    new CfnOutput(this, 'OrdersStreamArn', { value: ordersStream.streamArn });
    new CfnOutput(this, 'TelemetryStreamArn', { value: telemetryStream.streamArn });
  }
}
