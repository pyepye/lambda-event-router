import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import {
  AccountRecovery,
  FeaturePlan,
  StringAttribute,
  UserPool,
  UserPoolOperation,
  type UserPoolProps,
} from 'aws-cdk-lib/aws-cognito';
import { Effect, PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { LoggingFormat, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, type NodejsFunctionProps, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { Construct } from 'constructs';

const KMS_PENDING_WINDOW_DAYS = 7;

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

const sharedPoolProps: UserPoolProps = {
  selfSignUpEnabled: true,
  signInAliases: { username: true },
  autoVerify: { email: true },
  standardAttributes: { email: { required: true, mutable: true } },
  accountRecovery: AccountRecovery.EMAIL_ONLY,
  featurePlan: FeaturePlan.LITE,
  passwordPolicy: { minLength: 8, requireLowercase: true, requireUppercase: true, requireDigits: true },
  deletionProtection: false,
  removalPolicy: RemovalPolicy.DESTROY,
};

export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const applicantsPoolName = `${this.stackName}-applicants`;
    const staffPoolName = `${this.stackName}-staff`;

    const customSenderKey = new Key(this, 'CustomSenderKey', {
      description: 'Encrypts the codes Cognito hands to the custom email sender trigger',
      pendingWindow: Duration.days(KMS_PENDING_WINDOW_DAYS),
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Cognito encrypts each code under a grant it creates for itself, so the service principal needs
    // these on the key before the pool will accept a custom email sender trigger.
    customSenderKey.addToResourcePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        principals: [new ServicePrincipal('cognito-idp.amazonaws.com')],
        actions: ['kms:CreateGrant', 'kms:Encrypt', 'kms:Decrypt', 'kms:GenerateDataKey'],
        resources: ['*'],
      }),
    );

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
        APPLICANTS_POOL_NAME: applicantsPoolName,
        STAFF_POOL_NAME: staffPoolName,
        CUSTOM_SENDER_KEY_ARN: customSenderKey.keyArn,
      },
      bundling: sharedBundling,
    });

    // The worker turns the two pool names into ids at start up, which is what the userPoolId filters
    // match against. A pool holds the ARN of the Lambda it triggers, so CloudFormation rejects a
    // template that also puts the pool id in that Lambda's environment.
    workerFn.addToRolePolicy(
      new PolicyStatement({ effect: Effect.ALLOW, actions: ['cognito-idp:ListUserPools'], resources: ['*'] }),
    );
    customSenderKey.grantDecrypt(workerFn);

    const applicantsPool = new UserPool(this, 'ApplicantsPool', {
      ...sharedPoolProps,
      userPoolName: applicantsPoolName,
      customAttributes: { programme: new StringAttribute({ mutable: true }) },
      lambdaTriggers: {
        preSignUp: workerFn,
        postConfirmation: workerFn,
        preAuthentication: workerFn,
        postAuthentication: workerFn,
        preTokenGeneration: workerFn,
        defineAuthChallenge: workerFn,
        createAuthChallenge: workerFn,
        verifyAuthChallengeResponse: workerFn,
        userMigration: workerFn,
        customMessage: workerFn,
      },
    });

    const staffPool = new UserPool(this, 'StaffPool', {
      ...sharedPoolProps,
      userPoolName: staffPoolName,
      customAttributes: {
        department: new StringAttribute({ mutable: true }),
        staffNumber: new StringAttribute({ mutable: true }),
      },
      customSenderKmsKey: customSenderKey,
      lambdaTriggers: { preSignUp: workerFn, postConfirmation: workerFn },
    });
    staffPool.addTrigger(UserPoolOperation.CUSTOM_EMAIL_SENDER, workerFn);

    // preventUserExistenceErrors masks a trigger's own error as NotAuthorizedException, which hides
    // which route failed.
    const applicantsClient = applicantsPool.addClient('ApplicantsClient', {
      userPoolClientName: 'applicant-web',
      authFlows: { userPassword: true, custom: true, adminUserPassword: true },
      preventUserExistenceErrors: false,
    });

    const staffClient = staffPool.addClient('StaffClient', {
      userPoolClientName: 'staff-web',
      authFlows: { userPassword: true },
      preventUserExistenceErrors: false,
    });

    new CfnOutput(this, 'ApplicantsPoolId', { value: applicantsPool.userPoolId });
    new CfnOutput(this, 'ApplicantsClientId', { value: applicantsClient.userPoolClientId });
    new CfnOutput(this, 'StaffPoolId', { value: staffPool.userPoolId });
    new CfnOutput(this, 'StaffClientId', { value: staffClient.userPoolClientId });
    new CfnOutput(this, 'WorkerLogGroupName', { value: workerLogGroup.logGroupName });
  }
}
