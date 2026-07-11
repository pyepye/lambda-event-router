import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { EventBus, Rule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { LoggingFormat, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, type NodejsFunctionProps, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { Construct } from 'constructs';

import { EVENT_BUS_NAME, RULE_SOURCES } from '../src/config.js';

const WORKER_RETRY_ATTEMPTS = 2;

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
        LOCAL_ACCOUNT_ID: this.account,
        LOCAL_REGION: this.region,
      },
      bundling: sharedBundling,
    });

    // EventBridge invokes a Lambda target asynchronously, so the function's own async invoke config
    // owns what happens after a handler throws. Two retries is the Lambda default, pinned here
    // because the README counts the attempts.
    workerFn.configureAsyncInvoke({ retryAttempts: WORKER_RETRY_ATTEMPTS });

    const eventBus = new EventBus(this, 'EventBus', { eventBusName: EVENT_BUS_NAME });
    eventBus.applyRemovalPolicy(RemovalPolicy.DESTROY);

    // One rule does the coarse match and the router does the rest. An event whose source is on this
    // list but which no route claims still reaches the worker, which is how the no route path runs.
    new Rule(this, 'WorkerRule', {
      eventBus,
      eventPattern: { source: RULE_SOURCES },
      targets: [new LambdaFunction(workerFn)],
    });

    new CfnOutput(this, 'EventBusName', { value: eventBus.eventBusName });
    new CfnOutput(this, 'WorkerLogGroupName', { value: workerLogGroup.logGroupName });
  }
}
