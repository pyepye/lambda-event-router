import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { AttributeType, StreamViewType, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { LoggingFormat, Runtime, StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction, type NodejsFunctionProps, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { Construct } from 'constructs';

const WORKER_BATCH_SIZE = 10;

// A window this short still lets a run of writes arrive as one batch, and still lets the trigger space
// its failures far enough apart to land in separate batches.
const WORKER_BATCHING_WINDOW_SECONDS = 2;

// One retry, so a failing record produces two attempts and then the batch is discarded. The default of
// ten retries holds the shard for minutes and repeats every error without proving anything new.
const WORKER_RETRY_ATTEMPTS = 1;

const srcDir = fileURLToPath(new URL('../src', import.meta.url));
const entry = join(srcDir, 'index.ts');

// Nothing is external: the router reads stream records through `@aws-sdk/util-dynamodb`, which the
// Lambda runtime does not supply, so it has to be in the bundle.
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

    const ordersTable = new TableV2(this, 'OrdersTable', {
      tableName: `${this.stackName}-orders`,
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
      dynamoStream: StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // KEYS_ONLY, so its records carry no images at all. That is what the streamViewType filter picks
    // out, and it is all a cache eviction needs.
    const searchIndexTable = new TableV2(this, 'SearchIndexTable', {
      tableName: `${this.stackName}-search-index`,
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
      dynamoStream: StreamViewType.KEYS_ONLY,
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
        ORDERS_STREAM_ARN: ordersTable.tableStreamArn ?? '',
        SEARCH_INDEX_STREAM_ARN: searchIndexTable.tableStreamArn ?? '',
      },
      bundling: sharedBundling,
    });

    // TRIM_HORIZON, so the first trigger after a deploy is not lost. LATEST skips whatever was written
    // before the poller attached to the shard, which on a new stack is most of the first run.
    for (const table of [ordersTable, searchIndexTable]) {
      workerFn.addEventSource(
        new DynamoEventSource(table, {
          startingPosition: StartingPosition.TRIM_HORIZON,
          batchSize: WORKER_BATCH_SIZE,
          maxBatchingWindow: Duration.seconds(WORKER_BATCHING_WINDOW_SECONDS),
          retryAttempts: WORKER_RETRY_ATTEMPTS,
          reportBatchItemFailures: true,
        }),
      );
    }

    new CfnOutput(this, 'OrdersTableArn', { value: ordersTable.tableArn });
    new CfnOutput(this, 'SearchIndexTableArn', { value: searchIndexTable.tableArn });
  }
}
