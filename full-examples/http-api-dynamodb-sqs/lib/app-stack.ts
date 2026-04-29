import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CfnOutput, custom_resources, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { AttributeType, BillingMode, StreamViewType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { ManagedPolicy } from 'aws-cdk-lib/aws-iam';
import { FilterCriteria, FilterRule, LoggingFormat, Runtime, StartingPosition, Tracing } from 'aws-cdk-lib/aws-lambda';
import { DynamoEventSource, SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction, type NodejsFunctionProps, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import type { Construct } from 'constructs';

const DLQ_MAX_RECEIVE_COUNT = 3;
const STREAM_BATCH_SIZE = 10;
const WORKER_BATCH_SIZE = 10;
const WORKER_BATCHING_WINDOW_SECONDS = 5;

const SEED_STOCK = [
  { sku: 'widget-a', quantity: 100, lowStockThreshold: 5 },
  { sku: 'widget-b', quantity: 50, lowStockThreshold: 5 },
  { sku: 'widget-c', quantity: 6, lowStockThreshold: 5 },
];

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

export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const table = new Table(this, 'ler-example', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      stream: StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const seedItems = SEED_STOCK.map((stock) => ({
      PutRequest: {
        Item: {
          pk: { S: `STOCK` },
          sk: { S: stock.sku },
          quantity: { N: String(stock.quantity) },
          lowStockThreshold: { N: String(stock.lowStockThreshold) },
        },
      },
    }));
    const seedParams = {
      service: 'DynamoDB',
      action: 'batchWriteItem',
      parameters: { RequestItems: { [table.tableName]: seedItems } },
      physicalResourceId: custom_resources.PhysicalResourceId.of(`${table.tableName}-seed`),
    };
    new custom_resources.AwsCustomResource(this, 'SeedStock', {
      onCreate: seedParams,
      onUpdate: seedParams,
      policy: custom_resources.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [table.tableArn],
      }),
    });

    const dlq = new Queue(this, 'WorkerDlq', {
      retentionPeriod: Duration.days(14),
    });

    const workQueue = new Queue(this, 'WorkerQueue', {
      visibilityTimeout: Duration.seconds(60),
      deliveryDelay: Duration.seconds(1), // Give DynamoDB the chance to become eventually consistent
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: DLQ_MAX_RECEIVE_COUNT,
      },
    });

    const apiFn = new NodejsFunction(this, 'ApiFn', {
      functionName: `${this.stackName}-api`,
      entry,
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      memorySize: 512,
      timeout: Duration.seconds(10),
      loggingFormat: LoggingFormat.JSON,
      logRetention: RetentionDays.ONE_DAY,
      environment: {
        QUEUE_URL: workQueue.queueUrl,
        TABLE_NAME: table.tableName,
      },
      bundling: sharedBundling,
      tracing: Tracing.ACTIVE,
    });
    apiFn.role?.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'));
    table.grantReadWriteData(apiFn);
    workQueue.grantSendMessages(apiFn);

    const workerFn = new NodejsFunction(this, 'WorkerFn', {
      functionName: `${this.stackName}-worker`,
      entry,
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      memorySize: 512,
      timeout: Duration.seconds(30),
      loggingFormat: LoggingFormat.JSON,
      logRetention: RetentionDays.ONE_DAY,
      environment: {
        QUEUE_URL: workQueue.queueUrl,
        TABLE_NAME: table.tableName,
      },
      bundling: sharedBundling,
      tracing: Tracing.ACTIVE,
    });
    workerFn.role?.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'));
    table.grantReadWriteData(workerFn);
    workQueue.grantSendMessages(workerFn);

    workerFn.addEventSource(
      new DynamoEventSource(table, {
        startingPosition: StartingPosition.LATEST,
        batchSize: STREAM_BATCH_SIZE,
        reportBatchItemFailures: true,
        // Two filter expressions are OR'd by Lambda. The router does final dispatch.
        filters: [
          FilterCriteria.filter({
            eventName: FilterRule.or('INSERT'),
            dynamodb: { Keys: { pk: { S: ['ORDER'] } } },
          }),
          FilterCriteria.filter({
            eventName: FilterRule.or('MODIFY'),
            dynamodb: { Keys: { pk: { S: ['STOCK'] } } },
          }),
        ],
      }),
    );

    workerFn.addEventSource(
      new SqsEventSource(workQueue, {
        batchSize: WORKER_BATCH_SIZE,
        maxBatchingWindow: Duration.seconds(WORKER_BATCHING_WINDOW_SECONDS),
        reportBatchItemFailures: true,
      }),
    );

    const httpApi = new HttpApi(this, 'HttpApi');
    const apiIntegration = new HttpLambdaIntegration('ApiIntegration', apiFn);

    httpApi.addRoutes({
      path: '/orders',
      methods: [HttpMethod.POST],
      integration: apiIntegration,
    });

    httpApi.addRoutes({
      path: '/orders/{id}',
      methods: [HttpMethod.GET],
      integration: apiIntegration,
    });

    new CfnOutput(this, 'ApiUrl', { value: httpApi.apiEndpoint });
    new CfnOutput(this, 'TableName', { value: table.tableName });
    new CfnOutput(this, 'QueueUrl', { value: workQueue.queueUrl });
    new CfnOutput(this, 'DlqUrl', { value: dlq.queueUrl });
  }
}
