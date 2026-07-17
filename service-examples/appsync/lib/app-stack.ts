import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import {
  AppSyncAuthorizationType,
  AuthorizationType,
  type CfnGraphQLApi,
  Definition,
  EventApi,
  GraphqlApi,
} from 'aws-cdk-lib/aws-appsync';
import { LoggingFormat, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, type NodejsFunctionProps, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { Construct } from 'constructs';

import { AUDIT_NAMESPACE, PRESENCE_NAMESPACE, PROBE_NAMESPACE, TICKET_NAMESPACE } from '../src/utils/constants.js';

const FUNCTION_TIMEOUT_SECONDS = 10;
const FUNCTION_MEMORY_MB = 512;

const srcDir = fileURLToPath(new URL('../src', import.meta.url));
const libDir = fileURLToPath(new URL('.', import.meta.url));

// Above 0, AppSync sends the comments for a page of tickets to one invocation.
const COMMENTS_BATCH_SIZE = 5;

const RESOLVER_FIELDS = [
  { id: 'GetTicket', typeName: 'Query', fieldName: 'getTicket' },
  { id: 'ListTickets', typeName: 'Query', fieldName: 'listTickets' },
  { id: 'ListQueues', typeName: 'Query', fieldName: 'listQueues' },
  { id: 'CreateTicket', typeName: 'Mutation', fieldName: 'createTicket' },
  { id: 'EscalateTicket', typeName: 'Mutation', fieldName: 'escalateTicket' },
  { id: 'CloseTicket', typeName: 'Mutation', fieldName: 'closeTicket' },
  { id: 'TicketComments', typeName: 'Ticket', fieldName: 'comments', maxBatchSize: COMMENTS_BATCH_SIZE },
  { id: 'OnTicketCreated', typeName: 'Subscription', fieldName: 'onTicketCreated' },
];

const CHANNEL_NAMESPACES = [
  { id: 'TicketNamespace', name: TICKET_NAMESPACE },
  { id: 'PresenceNamespace', name: PRESENCE_NAMESPACE },
  { id: 'AuditNamespace', name: AUDIT_NAMESPACE },
  { id: 'ProbeNamespace', name: PROBE_NAMESPACE },
];

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

    const authorizerLogGroup = new LogGroup(this, 'AuthorizerLogGroup', {
      logGroupName: `/aws/lambda/${this.stackName}-authorizer`,
      retention: RetentionDays.ONE_DAY,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const workerFn = new NodejsFunction(this, 'WorkerFn', {
      functionName: `${this.stackName}-worker`,
      entry: join(srcDir, 'index.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      memorySize: FUNCTION_MEMORY_MB,
      timeout: Duration.seconds(FUNCTION_TIMEOUT_SECONDS),
      loggingFormat: LoggingFormat.JSON,
      logGroup: workerLogGroup,
      bundling: sharedBundling,
    });

    const authorizerFn = new NodejsFunction(this, 'AuthorizerFn', {
      functionName: `${this.stackName}-authorizer`,
      entry: join(srcDir, 'authorizer.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      memorySize: FUNCTION_MEMORY_MB,
      timeout: Duration.seconds(FUNCTION_TIMEOUT_SECONDS),
      loggingFormat: LoggingFormat.JSON,
      logGroup: authorizerLogGroup,
      bundling: sharedBundling,
    });

    // A cache TTL of 0 sends every request to the authorizer, so a second trigger run logs the same
    // authorizer lines as the first.
    const supportApi = new GraphqlApi(this, 'SupportApi', {
      name: `${this.stackName}-support`,
      definition: Definition.fromFile(join(libDir, 'schema.graphql')),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: AuthorizationType.LAMBDA,
          lambdaAuthorizerConfig: { handler: authorizerFn, resultsCacheTtl: Duration.seconds(0) },
        },
      },
    });

    const resolverSource = supportApi.addLambdaDataSource('ResolverSource', workerFn);
    for (const { id, typeName, fieldName, maxBatchSize } of RESOLVER_FIELDS) {
      resolverSource.createResolver(`${id}Resolver`, { typeName, fieldName, maxBatchSize });
    }

    const activityApi = new EventApi(this, 'ActivityApi', {
      apiName: `${this.stackName}-activity`,
      authorizationConfig: {
        authProviders: [
          { authorizationType: AppSyncAuthorizationType.API_KEY },
          {
            authorizationType: AppSyncAuthorizationType.LAMBDA,
            lambdaAuthorizerConfig: { handler: authorizerFn, resultsCacheTtl: Duration.seconds(0) },
          },
        ],
        connectionAuthModeTypes: [AppSyncAuthorizationType.API_KEY, AppSyncAuthorizationType.LAMBDA],
        defaultPublishAuthModeTypes: [AppSyncAuthorizationType.API_KEY, AppSyncAuthorizationType.LAMBDA],
        defaultSubscribeAuthModeTypes: [AppSyncAuthorizationType.API_KEY, AppSyncAuthorizationType.LAMBDA],
      },
    });

    const activitySource = activityApi.addLambdaDataSource('ActivitySource', workerFn);
    for (const { id, name } of CHANNEL_NAMESPACES) {
      activityApi.addChannelNamespace(id, {
        channelNamespaceName: name,
        publishHandlerConfig: { dataSource: activitySource, direct: true },
        subscribeHandlerConfig: { dataSource: activitySource, direct: true },
      });
    }

    const activityApiKey = activityApi.apiKeys.Default;
    if (!activityApiKey) throw new Error('The Event API has no default API key.');

    new CfnOutput(this, 'SupportApiUrl', { value: supportApi.graphqlUrl });
    new CfnOutput(this, 'SupportApiRealtimeUrl', {
      value: (supportApi.node.defaultChild as CfnGraphQLApi).attrRealtimeUrl,
    });
    new CfnOutput(this, 'ActivityApiHttpDns', { value: activityApi.httpDns });
    new CfnOutput(this, 'ActivityApiRealtimeDns', { value: activityApi.realtimeDns });
    new CfnOutput(this, 'ActivityApiKey', { value: activityApiKey.attrApiKey });
  }
}
