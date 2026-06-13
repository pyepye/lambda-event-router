import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CfnOutput, Duration, Stack, type StackProps } from 'aws-cdk-lib';
import { LoggingFormat, Runtime } from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction, type NodejsFunctionProps, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import type { Construct } from 'constructs';

const DLQ_MAX_RECEIVE_COUNT = 3;
const WORKER_BATCH_SIZE = 10;
const WORKER_BATCHING_WINDOW_SECONDS = 5;

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

    const notificationsDlq = new Queue(this, 'NotificationsDlq', {
      retentionPeriod: Duration.days(14),
    });
    const notificationsQueue = new Queue(this, 'NotificationsQueue', {
      visibilityTimeout: Duration.seconds(60),
      deadLetterQueue: { queue: notificationsDlq, maxReceiveCount: DLQ_MAX_RECEIVE_COUNT },
    });

    const priorityDlq = new Queue(this, 'PriorityDlq', {
      fifo: true,
      retentionPeriod: Duration.days(14),
    });
    const priorityQueue = new Queue(this, 'PriorityQueue', {
      fifo: true,
      contentBasedDeduplication: true,
      visibilityTimeout: Duration.seconds(60),
      deadLetterQueue: { queue: priorityDlq, maxReceiveCount: DLQ_MAX_RECEIVE_COUNT },
    });

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
        NOTIFICATIONS_QUEUE_ARN: notificationsQueue.queueArn,
        PRIORITY_QUEUE_ARN: priorityQueue.queueArn,
      },
      bundling: sharedBundling,
    });

    notificationsQueue.grantConsumeMessages(workerFn);
    priorityQueue.grantConsumeMessages(workerFn);

    workerFn.addEventSource(
      new SqsEventSource(notificationsQueue, {
        batchSize: WORKER_BATCH_SIZE,
        maxBatchingWindow: Duration.seconds(WORKER_BATCHING_WINDOW_SECONDS),
        reportBatchItemFailures: true,
      }),
    );

    // FIFO event sources do not take a batching window; ordering comes from the message group.
    workerFn.addEventSource(
      new SqsEventSource(priorityQueue, {
        batchSize: WORKER_BATCH_SIZE,
        reportBatchItemFailures: true,
      }),
    );

    new CfnOutput(this, 'NotificationsQueueUrl', { value: notificationsQueue.queueUrl });
    new CfnOutput(this, 'PriorityQueueUrl', { value: priorityQueue.queueUrl });
    new CfnOutput(this, 'NotificationsDlqUrl', { value: notificationsDlq.queueUrl });
    new CfnOutput(this, 'PriorityDlqUrl', { value: priorityDlq.queueUrl });
  }
}
