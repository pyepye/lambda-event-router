import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps, Tags } from 'aws-cdk-lib';
import { LoggingFormat, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, type NodejsFunctionProps, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import type { Construct } from 'constructs';

import { ROTATION_PAUSED_TAG, SECRET_NAMES, TOKEN_LENGTH } from '../src/utils/secrets.js';

const ROTATION_INTERVAL_DAYS = 30;

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

const generateToken = {
  passwordLength: TOKEN_LENGTH,
  excludePunctuation: true,
};

export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const paymentsApiToken = new Secret(this, 'PaymentsApiToken', {
      secretName: SECRET_NAMES.paymentsApiToken,
      generateSecretString: generateToken,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const webhookSigningKey = new Secret(this, 'WebhookSigningKey', {
      secretName: SECRET_NAMES.webhookSigningKey,
      generateSecretString: generateToken,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const searchIndexKey = new Secret(this, 'SearchIndexKey', {
      secretName: SECRET_NAMES.searchIndexKey,
      generateSecretString: generateToken,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const legacyFtpPassword = new Secret(this, 'LegacyFtpPassword', {
      secretName: SECRET_NAMES.legacyFtpPassword,
      generateSecretString: generateToken,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    Tags.of(legacyFtpPassword).add(ROTATION_PAUSED_TAG, 'true');

    const retiredReportToken = new Secret(this, 'RetiredReportToken', {
      secretName: SECRET_NAMES.retiredReportToken,
      generateSecretString: generateToken,
      removalPolicy: RemovalPolicy.DESTROY,
    });

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
      retryAttempts: 0,
      environment: {
        PAYMENTS_TOKEN_ARN: paymentsApiToken.secretArn,
      },
      bundling: sharedBundling,
    });

    // Each schedule grants the worker read and write on its own secret, and lets Secrets Manager
    // invoke it.
    for (const secret of [paymentsApiToken, webhookSigningKey, searchIndexKey, legacyFtpPassword, retiredReportToken]) {
      secret.addRotationSchedule('Rotation', {
        rotationLambda: workerFn,
        automaticallyAfter: Duration.days(ROTATION_INTERVAL_DAYS),
        rotateImmediatelyOnUpdate: false,
      });
    }

    new CfnOutput(this, 'WorkerLogGroupName', { value: workerLogGroup.logGroupName });
    new CfnOutput(this, 'PaymentsTokenArn', { value: paymentsApiToken.secretArn });
  }
}
