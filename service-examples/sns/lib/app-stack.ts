import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { LoggingFormat, Runtime } from 'aws-cdk-lib/aws-lambda';
import { SnsDestination } from 'aws-cdk-lib/aws-lambda-destinations';
import { NodejsFunction, type NodejsFunctionProps, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { LambdaSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import type { Construct } from 'constructs';

// One retry, so a failing record produces two attempts and then a delivery failure entry. The default
// of two retries triples every error in the log without proving anything the second retry does not.
const WORKER_RETRY_ATTEMPTS = 1;

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

    const ordersTopic = new Topic(this, 'OrdersTopic');
    const inventoryTopic = new Topic(this, 'InventoryTopic');

    // Lambda republishes an invocation that has run out of retries here. The worker subscribes to this
    // topic as well, so dead lettering stays inside SNS and needs no second service.
    const deliveryFailuresTopic = new Topic(this, 'DeliveryFailuresTopic');

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
      retryAttempts: WORKER_RETRY_ATTEMPTS,
      onFailure: new SnsDestination(deliveryFailuresTopic),
      environment: {
        ORDERS_TOPIC_ARN: ordersTopic.topicArn,
        INVENTORY_TOPIC_ARN: inventoryTopic.topicArn,
        DELIVERY_FAILURES_TOPIC_ARN: deliveryFailuresTopic.topicArn,
      },
      bundling: sharedBundling,
    });

    // No subscription filter policies anywhere: every published message reaches the worker, and the
    // router does all the filtering.
    ordersTopic.addSubscription(new LambdaSubscription(workerFn));
    inventoryTopic.addSubscription(new LambdaSubscription(workerFn));
    deliveryFailuresTopic.addSubscription(new LambdaSubscription(workerFn));

    new CfnOutput(this, 'OrdersTopicArn', { value: ordersTopic.topicArn });
    new CfnOutput(this, 'InventoryTopicArn', { value: inventoryTopic.topicArn });
    new CfnOutput(this, 'DeliveryFailuresTopicArn', { value: deliveryFailuresTopic.topicArn });
  }
}
