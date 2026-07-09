import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { LoggingFormat, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, type NodejsFunctionProps, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { FilterPattern, type IFilterPattern, LogGroup, RetentionDays, SubscriptionFilter } from 'aws-cdk-lib/aws-logs';
import { LambdaDestination } from 'aws-cdk-lib/aws-logs-destinations';
import type { Construct } from 'constructs';

import {
  AUDIT_LOG_GROUP,
  AUDIT_TRAFFIC_FILTER,
  CHECKOUT_ERRORS_FILTER,
  CHECKOUT_LOG_GROUP,
  CHECKOUT_TRAFFIC_FILTER,
  LEGACY_LOG_GROUP,
  LEGACY_TRAFFIC_FILTER,
  PAYMENTS_LOG_GROUP,
  PAYMENTS_TRAFFIC_FILTER,
  REFUNDS_LOG_GROUP,
  REFUNDS_TRAFFIC_FILTER,
} from '../src/config.js';

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
      bundling: sharedBundling,
    });

    const destination = new LambdaDestination(workerFn);

    const sourceLogGroup = (id: string, logGroupName: string): LogGroup =>
      new LogGroup(this, id, {
        logGroupName,
        retention: RetentionDays.ONE_DAY,
        removalPolicy: RemovalPolicy.DESTROY,
      });

    const subscribe = (id: string, logGroup: LogGroup, filterName: string, filterPattern: IFilterPattern): void => {
      new SubscriptionFilter(this, id, { logGroup, destination, filterName, filterPattern });
    };

    // Two filters on the checkout group, which is the CloudWatch Logs maximum. One takes error lines
    // only, the other takes everything, so an error line arrives twice under different filter names.
    const checkoutLogGroup = sourceLogGroup('CheckoutLogGroup', CHECKOUT_LOG_GROUP);
    subscribe(
      'CheckoutErrorsSubscription',
      checkoutLogGroup,
      CHECKOUT_ERRORS_FILTER,
      FilterPattern.anyTerm('ERROR', 'FATAL'),
    );
    subscribe('CheckoutTrafficSubscription', checkoutLogGroup, CHECKOUT_TRAFFIC_FILTER, FilterPattern.allEvents());

    const paymentsLogGroup = sourceLogGroup('PaymentsLogGroup', PAYMENTS_LOG_GROUP);
    subscribe('PaymentsTrafficSubscription', paymentsLogGroup, PAYMENTS_TRAFFIC_FILTER, FilterPattern.allEvents());

    const refundsLogGroup = sourceLogGroup('RefundsLogGroup', REFUNDS_LOG_GROUP);
    subscribe('RefundsTrafficSubscription', refundsLogGroup, REFUNDS_TRAFFIC_FILTER, FilterPattern.allEvents());

    const auditLogGroup = sourceLogGroup('AuditLogGroup', AUDIT_LOG_GROUP);
    subscribe('AuditTrafficSubscription', auditLogGroup, AUDIT_TRAFFIC_FILTER, FilterPattern.allEvents());

    const legacyLogGroup = sourceLogGroup('LegacyLogGroup', LEGACY_LOG_GROUP);
    subscribe('LegacyTrafficSubscription', legacyLogGroup, LEGACY_TRAFFIC_FILTER, FilterPattern.allEvents());

    new CfnOutput(this, 'WorkerLogGroupName', { value: workerLogGroup.logGroupName });
  }
}
