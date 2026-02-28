import type {
  ALBEvent,
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  APIGatewayRequestAuthorizerEvent,
  APIGatewayRequestAuthorizerEventV2,
  APIGatewayTokenAuthorizerEvent,
  AppSyncAuthorizerEvent,
  AppSyncResolverEvent,
  CloudWatchLogsEvent,
  CodePipelineEvent,
  ConnectContactFlowEvent,
  Context,
  DynamoDBRecord,
  DynamoDBStreamEvent,
  LexV2Event,
  S3BatchEvent,
  S3BatchEventTask,
  S3Event,
  S3EventRecord,
  SESEvent,
  SESEventRecord,
  SecretsManagerRotationEvent,
  SNSEvent,
  SNSEventRecord,
  SQSEvent,
  SQSRecord,
} from 'aws-lambda';
import { test as viTest } from 'vitest';
import type {
  ActiveMQEvent,
  ActiveMQHandlerEvent,
  ActiveMQMessage,
  ActiveMQMessageOverrides,
  CreateActiveMQHandlerEventOptions,
} from './activeMQ.js';
import { createActiveMQEvent, createActiveMQHandlerEvent, createActiveMQMessage } from './activeMQ.js';
import type { ALBEventOverrides, ALBHandlerEvent, CreateALBHandlerEventOptions } from './alb.js';
import { createALBEvent, createALBHandlerEvent } from './alb.js';
import type {
  ApiGatewayLambdaAuthorizerRequestV1EventOverrides,
  ApiGatewayLambdaAuthorizerRequestV1HandlerEvent,
  ApiGatewayLambdaAuthorizerRequestV2EventOverrides,
  ApiGatewayLambdaAuthorizerRequestV2HandlerEvent,
  ApiGatewayLambdaAuthorizerTokenEventOverrides,
  ApiGatewayLambdaAuthorizerTokenHandlerEvent,
  CreateApiGatewayLambdaAuthorizerRequestV1HandlerEventOptions,
  CreateApiGatewayLambdaAuthorizerRequestV2HandlerEventOptions,
  CreateApiGatewayLambdaAuthorizerTokenHandlerEventOptions,
} from './apiGatewayLambdaAuthorizer.js';
import {
  createApiGatewayLambdaAuthorizerRequestV1Event,
  createApiGatewayLambdaAuthorizerRequestV1HandlerEvent,
  createApiGatewayLambdaAuthorizerRequestV2Event,
  createApiGatewayLambdaAuthorizerRequestV2HandlerEvent,
  createApiGatewayLambdaAuthorizerTokenEvent,
  createApiGatewayLambdaAuthorizerTokenHandlerEvent,
} from './apiGatewayLambdaAuthorizer.js';
import type {
  ApiGatewayV1EventOverrides,
  ApiGatewayV1HandlerEvent,
  CreateApiGatewayV1HandlerEventOptions,
} from './apiGatewayV1.js';
import { createApiGatewayV1Event, createApiGatewayV1HandlerEvent } from './apiGatewayV1.js';
import type {
  ApiGatewayV2EventOverrides,
  ApiGatewayV2HandlerEvent,
  CreateApiGatewayV2HandlerEventOptions,
} from './apiGatewayV2.js';
import { createApiGatewayV2Event, createApiGatewayV2HandlerEvent } from './apiGatewayV2.js';
import type {
  AppSyncAuthorizerHandlerEvent,
  AppSyncEventsEvent,
  AppSyncEventsEventOverrides,
  AppSyncEventsHandlerEvent,
  AppSyncResolverEventOverrides,
  AppSyncResolverHandlerEvent,
  CreateAppSyncAuthorizerHandlerEventOptions,
  CreateAppSyncEventsHandlerEventOptions,
  CreateAppSyncResolverHandlerEventOptions,
} from './appSync.js';
import {
  createAppSyncAuthorizerEvent,
  createAppSyncAuthorizerHandlerEvent,
  createAppSyncEventsEvent,
  createAppSyncEventsHandlerEvent,
  createAppSyncResolverEvent,
  createAppSyncResolverHandlerEvent,
} from './appSync.js';
import type {
  CloudWatchLogsEventOverrides,
  CloudWatchLogsHandlerEvent,
  CreateCloudWatchLogsHandlerEventOptions,
} from './cloudWatchLogs.js';
import { createCloudWatchLogsEvent, createCloudWatchLogsHandlerEvent } from './cloudWatchLogs.js';
import type {
  CodeCommitEvent,
  CodeCommitHandlerEvent,
  CodeCommitRecord,
  CodeCommitRecordOverrides,
  CodeCommitReference,
  CodeCommitReferenceOverrides,
  CreateCodeCommitHandlerEventOptions,
} from './codeCommit.js';
import {
  createCodeCommitEvent,
  createCodeCommitHandlerEvent,
  createCodeCommitRecord,
  createCodeCommitReference,
} from './codeCommit.js';
import type {
  CodePipelineEventOverrides,
  CodePipelineHandlerEvent,
  CreateCodePipelineHandlerEventOptions,
} from './codepipeline.js';
import { createCodePipelineEvent, createCodePipelineHandlerEvent } from './codepipeline.js';
import {
  createCognitoCreateAuthChallengeEvent,
  createCognitoCreateAuthChallengeHandlerEvent,
  createCognitoCustomEmailSenderEvent,
  createCognitoCustomEmailSenderHandlerEvent,
  createCognitoCustomMessageEvent,
  createCognitoCustomMessageHandlerEvent,
  createCognitoDefineAuthChallengeEvent,
  createCognitoDefineAuthChallengeHandlerEvent,
  createCognitoPostAuthenticationEvent,
  createCognitoPostAuthenticationHandlerEvent,
  createCognitoPostConfirmationEvent,
  createCognitoPostConfirmationHandlerEvent,
  createCognitoPreAuthenticationEvent,
  createCognitoPreAuthenticationHandlerEvent,
  createCognitoPreSignUpEvent,
  createCognitoPreSignUpHandlerEvent,
  createCognitoPreTokenGenerationEvent,
  createCognitoPreTokenGenerationHandlerEvent,
  createCognitoUserMigrationEvent,
  createCognitoUserMigrationHandlerEvent,
  createCognitoVerifyAuthChallengeResponseEvent,
  createCognitoVerifyAuthChallengeResponseHandlerEvent,
} from './cognito.js';
import type {
  ConfigEvent,
  ConfigEventOverrides,
  ConfigHandlerEvent,
  ConfigurationItem,
  ConfigurationItemOverrides,
  ConfigurationItemSummary,
  ConfigurationItemSummaryOverrides,
  CreateConfigHandlerEventOptions,
} from './config.js';
import {
  createConfigEvent,
  createConfigHandlerEvent,
  createConfigurationItem,
  createConfigurationItemSummary,
} from './config.js';
import type { ConnectEventOverrides, ConnectHandlerEvent, CreateConnectHandlerEventOptions } from './connect.js';
import { createConnectEvent, createConnectHandlerEvent } from './connect.js';
import { createMockContext } from './context.js';
import type { DeepPartial } from './deepPartial.js';
import type {
  CreateDocumentDBHandlerEventOptions,
  DocumentDBChangeEventOverrides,
  DocumentDBHandlerEvent,
} from './documentdb.js';
import {
  createDocumentDBChangeEvent,
  createDocumentDBDeleteEntry,
  createDocumentDBEvent,
  createDocumentDBHandlerEvent,
  createDocumentDBInsertEntry,
  createDocumentDBReplaceEntry,
  createDocumentDBUpdateEntry,
} from './documentdb.js';
import type { CreateDynamoDBHandlerEventOptions, DynamoDBHandlerEvent, DynamoDBRecordOverrides } from './dynamodb.js';
import {
  createDynamoDBEvent,
  createDynamoDBHandlerEvent,
  createDynamoDBInsertRecord,
  createDynamoDBModifyRecord,
  createDynamoDBRecord,
  createDynamoDBRemoveRecord,
} from './dynamodb.js';
import type {
  CreateEventBridgeHandlerEventOptions,
  EventBridgeEvent,
  EventBridgeEventOverrides,
  EventBridgeHandlerEvent,
} from './eventbridge.js';
import { createEventBridgeEvent, createEventBridgeHandlerEvent } from './eventbridge.js';
import type { CreateKafkaHandlerEventOptions, KafkaHandlerEvent, KafkaRecordOverrides } from './kafka.js';
import { createKafkaHandlerEvent, createKafkaRecord, createMSKEvent, createSelfManagedKafkaEvent } from './kafka.js';
import type { CreateLexHandlerEventOptions, LexEventOverrides, LexHandlerEvent } from './lex.js';
import { createLexEvent, createLexHandlerEvent } from './lex.js';
import type {
  CreateRabbitMQHandlerEventOptions,
  RabbitMQEvent,
  RabbitMQHandlerEvent,
  RabbitMQMessage,
  RabbitMQMessageOverrides,
} from './rabbitMQ.js';
import { createRabbitMQEvent, createRabbitMQHandlerEvent, createRabbitMQMessage } from './rabbitMQ.js';
import type {
  CreateS3BatchHandlerEventOptions,
  CreateS3HandlerEventOptions,
  S3BatchHandlerEvent,
  S3HandlerEvent,
  S3RecordOverrides,
} from './s3.js';
import {
  createS3BatchEvent,
  createS3BatchHandlerEvent,
  createS3BatchTask,
  createS3Event,
  createS3HandlerEvent,
  createS3Record,
} from './s3.js';
import type {
  CreateSecretsManagerHandlerEventOptions,
  SecretsManagerHandlerEvent,
  SecretsManagerRotationEventOverrides,
} from './secretsManager.js';
import { createSecretsManagerHandlerEvent, createSecretsManagerRotationEvent } from './secretsManager.js';
import type { CreateSESHandlerEventOptions, SESHandlerEvent, SESRecordOverrides } from './ses.js';
import { createSESEvent, createSESHandlerEvent, createSESRecord } from './ses.js';
import type { CreateSNSHandlerEventOptions, SNSHandlerEvent, SNSRecordOverrides } from './sns.js';
import { createSNSEvent, createSNSHandlerEvent, createSNSRecord } from './sns.js';
import type { CreateSQSHandlerEventOptions, SQSHandlerEvent, SQSRecordOverrides } from './sqs.js';
import { createSQSEvent, createSQSHandlerEvent, createSQSRecord } from './sqs.js';
import type {
  CreateVPCLatticeV1HandlerEventOptions,
  CreateVPCLatticeV2HandlerEventOptions,
  VPCLatticeV1EventOverrides,
  VPCLatticeV1HandlerEvent,
  VPCLatticeV2EventOverrides,
  VPCLatticeV2HandlerEvent,
} from './vpcLattice.js';
import {
  createVPCLatticeV1Event,
  createVPCLatticeV1HandlerEvent,
  createVPCLatticeV2Event,
  createVPCLatticeV2HandlerEvent,
} from './vpcLattice.js';
import type {
  CreateWebSocketHandlerEventOptions,
  WebSocketEventOverrides,
  WebSocketHandlerEvent,
} from './webSocket.js';
import { createWebSocketEvent, createWebSocketHandlerEvent } from './webSocket.js';

function fixture<T>(creator: T) {
  return async ({ task }: { task: unknown }, use: (value: T) => Promise<void>): Promise<void> => {
    void task;
    await use(creator);
  };
}

export interface TestFixtures {
  appSyncResolverEvent: (overrides?: AppSyncResolverEventOverrides) => AppSyncResolverEvent<Record<string, unknown>>;
  appSyncResolverHandlerEvent: (options?: CreateAppSyncResolverHandlerEventOptions) => AppSyncResolverHandlerEvent;
  appSyncAuthorizerEvent: (overrides?: DeepPartial<AppSyncAuthorizerEvent>) => AppSyncAuthorizerEvent;
  appSyncAuthorizerHandlerEvent: (
    options?: CreateAppSyncAuthorizerHandlerEventOptions,
  ) => AppSyncAuthorizerHandlerEvent;
  appSyncEventsEvent: (overrides?: AppSyncEventsEventOverrides) => AppSyncEventsEvent;
  appSyncEventsHandlerEvent: (options?: CreateAppSyncEventsHandlerEventOptions) => AppSyncEventsHandlerEvent;
  connectEvent: (overrides?: ConnectEventOverrides) => ConnectContactFlowEvent;
  connectHandlerEvent: (options?: CreateConnectHandlerEventOptions) => ConnectHandlerEvent;
  lexEvent: (overrides?: LexEventOverrides) => LexV2Event;
  lexHandlerEvent: (options?: CreateLexHandlerEventOptions) => LexHandlerEvent;
  context: (overrides?: Partial<Context>) => Context;
  sqsRecord: (overrides?: SQSRecordOverrides) => SQSRecord;
  sqsEvent: (records?: SQSRecord[]) => SQSEvent;
  sqsHandlerEvent: (options?: CreateSQSHandlerEventOptions) => SQSHandlerEvent;
  snsRecord: (overrides?: SNSRecordOverrides) => SNSEventRecord;
  snsEvent: (records?: SNSEventRecord[]) => SNSEvent;
  snsHandlerEvent: (options?: CreateSNSHandlerEventOptions) => SNSHandlerEvent;
  sesRecord: (overrides?: SESRecordOverrides) => SESEventRecord;
  sesEvent: (records?: SESEventRecord[]) => SESEvent;
  sesHandlerEvent: (options?: CreateSESHandlerEventOptions) => SESHandlerEvent;
  s3Record: (overrides?: S3RecordOverrides) => S3EventRecord;
  s3Event: (records?: S3EventRecord[]) => S3Event;
  s3HandlerEvent: (options?: CreateS3HandlerEventOptions) => S3HandlerEvent;
  s3BatchTask: (overrides?: Partial<S3BatchEventTask>) => S3BatchEventTask;
  s3BatchEvent: (overrides?: Partial<Omit<S3BatchEvent, 'tasks'>> & { tasks?: S3BatchEventTask[] }) => S3BatchEvent;
  s3BatchHandlerEvent: (options?: CreateS3BatchHandlerEventOptions) => S3BatchHandlerEvent;
  eventBridgeEvent: (overrides?: EventBridgeEventOverrides) => EventBridgeEvent;
  eventBridgeHandlerEvent: (options?: CreateEventBridgeHandlerEventOptions) => EventBridgeHandlerEvent;
  secretsManagerEvent: (overrides?: SecretsManagerRotationEventOverrides) => SecretsManagerRotationEvent;
  secretsManagerHandlerEvent: (options?: CreateSecretsManagerHandlerEventOptions) => SecretsManagerHandlerEvent;
  dynamoDBRecord: (overrides?: DynamoDBRecordOverrides) => DynamoDBRecord;
  dynamoDBInsertRecord: (overrides?: DynamoDBRecordOverrides) => DynamoDBRecord;
  dynamoDBModifyRecord: (overrides?: DynamoDBRecordOverrides) => DynamoDBRecord;
  dynamoDBRemoveRecord: (overrides?: DynamoDBRecordOverrides) => DynamoDBRecord;
  dynamoDBStreamEvent: (records?: DynamoDBRecord[]) => DynamoDBStreamEvent;
  dynamoDBStreamHandlerEvent: (options?: CreateDynamoDBHandlerEventOptions) => DynamoDBHandlerEvent;
  documentDBChangeEvent: (overrides?: DocumentDBChangeEventOverrides) => ReturnType<typeof createDocumentDBChangeEvent>;
  documentDBInsertEntry: (overrides?: DocumentDBChangeEventOverrides) => ReturnType<typeof createDocumentDBInsertEntry>;
  documentDBUpdateEntry: (overrides?: DocumentDBChangeEventOverrides) => ReturnType<typeof createDocumentDBUpdateEntry>;
  documentDBReplaceEntry: (
    overrides?: DocumentDBChangeEventOverrides,
  ) => ReturnType<typeof createDocumentDBReplaceEntry>;
  documentDBDeleteEntry: (overrides?: DocumentDBChangeEventOverrides) => ReturnType<typeof createDocumentDBDeleteEntry>;
  documentDBEvent: (
    entries?: ReturnType<typeof createDocumentDBInsertEntry>[],
  ) => ReturnType<typeof createDocumentDBEvent>;
  documentDBHandlerEvent: (options?: CreateDocumentDBHandlerEventOptions) => DocumentDBHandlerEvent;
  codePipelineEvent: (overrides?: CodePipelineEventOverrides) => CodePipelineEvent;
  codePipelineHandlerEvent: (options?: CreateCodePipelineHandlerEventOptions) => CodePipelineHandlerEvent;
  codeCommitReference: (overrides?: CodeCommitReferenceOverrides) => CodeCommitReference;
  codeCommitRecord: (overrides?: CodeCommitRecordOverrides) => CodeCommitRecord;
  codeCommitEvent: (records?: CodeCommitRecord[]) => CodeCommitEvent;
  codeCommitHandlerEvent: (options?: CreateCodeCommitHandlerEventOptions) => CodeCommitHandlerEvent;
  cloudWatchLogsEvent: (overrides?: CloudWatchLogsEventOverrides) => CloudWatchLogsEvent;
  cloudWatchLogsHandlerEvent: (options?: CreateCloudWatchLogsHandlerEventOptions) => CloudWatchLogsHandlerEvent;
  activeMQMessage: (overrides?: ActiveMQMessageOverrides) => ActiveMQMessage;
  activeMQEvent: (messages?: ActiveMQMessage[]) => ActiveMQEvent;
  activeMQHandlerEvent: (options?: CreateActiveMQHandlerEventOptions) => ActiveMQHandlerEvent;
  kafkaRecord: (overrides?: KafkaRecordOverrides) => ReturnType<typeof createKafkaRecord>;
  kafkaMSKEvent: (recordsByTopic?: Parameters<typeof createMSKEvent>[0]) => ReturnType<typeof createMSKEvent>;
  kafkaSelfManagedEvent: (
    recordsByTopic?: Parameters<typeof createSelfManagedKafkaEvent>[0],
  ) => ReturnType<typeof createSelfManagedKafkaEvent>;
  kafkaHandlerEvent: (options?: CreateKafkaHandlerEventOptions) => KafkaHandlerEvent;
  apiGatewayV1Event: (overrides?: ApiGatewayV1EventOverrides) => APIGatewayProxyEvent;
  apiGatewayV1HandlerEvent: (options?: CreateApiGatewayV1HandlerEventOptions) => ApiGatewayV1HandlerEvent;
  apiGatewayV2Event: (overrides?: ApiGatewayV2EventOverrides) => APIGatewayProxyEventV2;
  apiGatewayV2HandlerEvent: (options?: CreateApiGatewayV2HandlerEventOptions) => ApiGatewayV2HandlerEvent;
  albEvent: (overrides?: ALBEventOverrides) => ALBEvent;
  albHandlerEvent: (options?: CreateALBHandlerEventOptions) => ALBHandlerEvent;
  cognitoPreSignUpEvent: typeof createCognitoPreSignUpEvent;
  cognitoPreSignUpHandlerEvent: typeof createCognitoPreSignUpHandlerEvent;
  cognitoPreAuthenticationEvent: typeof createCognitoPreAuthenticationEvent;
  cognitoPreAuthenticationHandlerEvent: typeof createCognitoPreAuthenticationHandlerEvent;
  cognitoPostAuthenticationEvent: typeof createCognitoPostAuthenticationEvent;
  cognitoPostAuthenticationHandlerEvent: typeof createCognitoPostAuthenticationHandlerEvent;
  cognitoPostConfirmationEvent: typeof createCognitoPostConfirmationEvent;
  cognitoPostConfirmationHandlerEvent: typeof createCognitoPostConfirmationHandlerEvent;
  cognitoDefineAuthChallengeEvent: typeof createCognitoDefineAuthChallengeEvent;
  cognitoDefineAuthChallengeHandlerEvent: typeof createCognitoDefineAuthChallengeHandlerEvent;
  cognitoCreateAuthChallengeEvent: typeof createCognitoCreateAuthChallengeEvent;
  cognitoCreateAuthChallengeHandlerEvent: typeof createCognitoCreateAuthChallengeHandlerEvent;
  cognitoVerifyAuthChallengeResponseEvent: typeof createCognitoVerifyAuthChallengeResponseEvent;
  cognitoVerifyAuthChallengeResponseHandlerEvent: typeof createCognitoVerifyAuthChallengeResponseHandlerEvent;
  cognitoCustomMessageEvent: typeof createCognitoCustomMessageEvent;
  cognitoCustomMessageHandlerEvent: typeof createCognitoCustomMessageHandlerEvent;
  cognitoCustomEmailSenderEvent: typeof createCognitoCustomEmailSenderEvent;
  cognitoCustomEmailSenderHandlerEvent: typeof createCognitoCustomEmailSenderHandlerEvent;
  cognitoPreTokenGenerationEvent: typeof createCognitoPreTokenGenerationEvent;
  cognitoPreTokenGenerationHandlerEvent: typeof createCognitoPreTokenGenerationHandlerEvent;
  cognitoUserMigrationEvent: typeof createCognitoUserMigrationEvent;
  cognitoUserMigrationHandlerEvent: typeof createCognitoUserMigrationHandlerEvent;
  rabbitMQMessage: (overrides?: RabbitMQMessageOverrides) => RabbitMQMessage;
  rabbitMQEvent: (messagesByQueue?: Record<string, RabbitMQMessage[]>) => RabbitMQEvent;
  rabbitMQHandlerEvent: (options?: CreateRabbitMQHandlerEventOptions) => RabbitMQHandlerEvent;
  vpcLatticeV1Event: (overrides?: VPCLatticeV1EventOverrides) => ReturnType<typeof createVPCLatticeV1Event>;
  vpcLatticeV1HandlerEvent: (options?: CreateVPCLatticeV1HandlerEventOptions) => VPCLatticeV1HandlerEvent;
  vpcLatticeV2Event: (overrides?: VPCLatticeV2EventOverrides) => ReturnType<typeof createVPCLatticeV2Event>;
  vpcLatticeV2HandlerEvent: (options?: CreateVPCLatticeV2HandlerEventOptions) => VPCLatticeV2HandlerEvent;
  webSocketEvent: (overrides?: WebSocketEventOverrides) => ReturnType<typeof createWebSocketEvent>;
  webSocketHandlerEvent: (options?: CreateWebSocketHandlerEventOptions) => WebSocketHandlerEvent;
  apiGatewayLambdaAuthorizerTokenEvent: (
    overrides?: ApiGatewayLambdaAuthorizerTokenEventOverrides,
  ) => APIGatewayTokenAuthorizerEvent;
  apiGatewayLambdaAuthorizerTokenHandlerEvent: (
    options?: CreateApiGatewayLambdaAuthorizerTokenHandlerEventOptions,
  ) => ApiGatewayLambdaAuthorizerTokenHandlerEvent;
  apiGatewayLambdaAuthorizerRequestV1Event: (
    overrides?: ApiGatewayLambdaAuthorizerRequestV1EventOverrides,
  ) => APIGatewayRequestAuthorizerEvent;
  apiGatewayLambdaAuthorizerRequestV1HandlerEvent: (
    options?: CreateApiGatewayLambdaAuthorizerRequestV1HandlerEventOptions,
  ) => ApiGatewayLambdaAuthorizerRequestV1HandlerEvent;
  apiGatewayLambdaAuthorizerRequestV2Event: (
    overrides?: ApiGatewayLambdaAuthorizerRequestV2EventOverrides,
  ) => APIGatewayRequestAuthorizerEventV2;
  apiGatewayLambdaAuthorizerRequestV2HandlerEvent: (
    options?: CreateApiGatewayLambdaAuthorizerRequestV2HandlerEventOptions,
  ) => ApiGatewayLambdaAuthorizerRequestV2HandlerEvent;
  configEvent: (overrides?: ConfigEventOverrides) => ConfigEvent;
  configHandlerEvent: (options?: CreateConfigHandlerEventOptions) => ConfigHandlerEvent;
  configurationItem: (overrides?: ConfigurationItemOverrides) => ConfigurationItem;
  configurationItemSummary: (overrides?: ConfigurationItemSummaryOverrides) => ConfigurationItemSummary;
}

export const test: ReturnType<typeof viTest.extend<TestFixtures>> = viTest.extend<TestFixtures>({
  appSyncResolverEvent: fixture(createAppSyncResolverEvent),
  appSyncResolverHandlerEvent: fixture(createAppSyncResolverHandlerEvent),
  appSyncAuthorizerEvent: fixture(createAppSyncAuthorizerEvent),
  appSyncAuthorizerHandlerEvent: fixture(createAppSyncAuthorizerHandlerEvent),
  appSyncEventsEvent: fixture(createAppSyncEventsEvent),
  appSyncEventsHandlerEvent: fixture(createAppSyncEventsHandlerEvent),
  connectEvent: fixture(createConnectEvent),
  connectHandlerEvent: fixture(createConnectHandlerEvent),
  lexEvent: fixture(createLexEvent),
  lexHandlerEvent: fixture(createLexHandlerEvent),
  context: fixture(createMockContext),
  sqsRecord: fixture(createSQSRecord),
  sqsEvent: fixture(createSQSEvent),
  sqsHandlerEvent: fixture(createSQSHandlerEvent),
  snsRecord: fixture(createSNSRecord),
  snsEvent: fixture(createSNSEvent),
  snsHandlerEvent: fixture(createSNSHandlerEvent),
  sesRecord: fixture(createSESRecord),
  sesEvent: fixture(createSESEvent),
  sesHandlerEvent: fixture(createSESHandlerEvent),
  s3Record: fixture(createS3Record),
  s3Event: fixture(createS3Event),
  s3HandlerEvent: fixture(createS3HandlerEvent),
  s3BatchTask: fixture(createS3BatchTask),
  s3BatchEvent: fixture(createS3BatchEvent),
  s3BatchHandlerEvent: fixture(createS3BatchHandlerEvent),
  // Need different eventBridge fixtures to handle the different types
  eventBridgeEvent: fixture(createEventBridgeEvent),
  eventBridgeHandlerEvent: fixture(createEventBridgeHandlerEvent),
  secretsManagerEvent: fixture(createSecretsManagerRotationEvent),
  secretsManagerHandlerEvent: fixture(createSecretsManagerHandlerEvent),
  dynamoDBRecord: fixture(createDynamoDBRecord),
  dynamoDBInsertRecord: fixture(createDynamoDBInsertRecord),
  dynamoDBModifyRecord: fixture(createDynamoDBModifyRecord),
  dynamoDBRemoveRecord: fixture(createDynamoDBRemoveRecord),
  dynamoDBStreamEvent: fixture(createDynamoDBEvent),
  dynamoDBStreamHandlerEvent: fixture(createDynamoDBHandlerEvent),
  codePipelineEvent: fixture(createCodePipelineEvent),
  codePipelineHandlerEvent: fixture(createCodePipelineHandlerEvent),
  codeCommitReference: fixture(createCodeCommitReference),
  codeCommitRecord: fixture(createCodeCommitRecord),
  codeCommitEvent: fixture(createCodeCommitEvent),
  codeCommitHandlerEvent: fixture(createCodeCommitHandlerEvent),
  documentDBChangeEvent: fixture(createDocumentDBChangeEvent),
  documentDBInsertEntry: fixture(createDocumentDBInsertEntry),
  documentDBUpdateEntry: fixture(createDocumentDBUpdateEntry),
  documentDBReplaceEntry: fixture(createDocumentDBReplaceEntry),
  documentDBDeleteEntry: fixture(createDocumentDBDeleteEntry),
  documentDBEvent: fixture(createDocumentDBEvent),
  documentDBHandlerEvent: fixture(createDocumentDBHandlerEvent),
  cloudWatchLogsEvent: fixture(createCloudWatchLogsEvent),
  cloudWatchLogsHandlerEvent: fixture(createCloudWatchLogsHandlerEvent),
  activeMQMessage: fixture(createActiveMQMessage),
  activeMQEvent: fixture(createActiveMQEvent),
  activeMQHandlerEvent: fixture(createActiveMQHandlerEvent),
  kafkaRecord: fixture(createKafkaRecord),
  kafkaMSKEvent: fixture(createMSKEvent),
  kafkaSelfManagedEvent: fixture(createSelfManagedKafkaEvent),
  kafkaHandlerEvent: fixture(createKafkaHandlerEvent),
  apiGatewayV1Event: fixture(createApiGatewayV1Event),
  apiGatewayV1HandlerEvent: fixture(createApiGatewayV1HandlerEvent),
  apiGatewayV2Event: fixture(createApiGatewayV2Event),
  apiGatewayV2HandlerEvent: fixture(createApiGatewayV2HandlerEvent),
  albEvent: fixture(createALBEvent),
  albHandlerEvent: fixture(createALBHandlerEvent),
  cognitoPreSignUpEvent: fixture(createCognitoPreSignUpEvent),
  cognitoPreSignUpHandlerEvent: fixture(createCognitoPreSignUpHandlerEvent),
  cognitoPreAuthenticationEvent: fixture(createCognitoPreAuthenticationEvent),
  cognitoPreAuthenticationHandlerEvent: fixture(createCognitoPreAuthenticationHandlerEvent),
  cognitoPostAuthenticationEvent: fixture(createCognitoPostAuthenticationEvent),
  cognitoPostAuthenticationHandlerEvent: fixture(createCognitoPostAuthenticationHandlerEvent),
  cognitoPostConfirmationEvent: fixture(createCognitoPostConfirmationEvent),
  cognitoPostConfirmationHandlerEvent: fixture(createCognitoPostConfirmationHandlerEvent),
  cognitoDefineAuthChallengeEvent: fixture(createCognitoDefineAuthChallengeEvent),
  cognitoDefineAuthChallengeHandlerEvent: fixture(createCognitoDefineAuthChallengeHandlerEvent),
  cognitoCreateAuthChallengeEvent: fixture(createCognitoCreateAuthChallengeEvent),
  cognitoCreateAuthChallengeHandlerEvent: fixture(createCognitoCreateAuthChallengeHandlerEvent),
  cognitoVerifyAuthChallengeResponseEvent: fixture(createCognitoVerifyAuthChallengeResponseEvent),
  cognitoVerifyAuthChallengeResponseHandlerEvent: fixture(createCognitoVerifyAuthChallengeResponseHandlerEvent),
  cognitoCustomMessageEvent: fixture(createCognitoCustomMessageEvent),
  cognitoCustomMessageHandlerEvent: fixture(createCognitoCustomMessageHandlerEvent),
  cognitoCustomEmailSenderEvent: fixture(createCognitoCustomEmailSenderEvent),
  cognitoCustomEmailSenderHandlerEvent: fixture(createCognitoCustomEmailSenderHandlerEvent),
  cognitoPreTokenGenerationEvent: fixture(createCognitoPreTokenGenerationEvent),
  cognitoPreTokenGenerationHandlerEvent: fixture(createCognitoPreTokenGenerationHandlerEvent),
  cognitoUserMigrationEvent: fixture(createCognitoUserMigrationEvent),
  cognitoUserMigrationHandlerEvent: fixture(createCognitoUserMigrationHandlerEvent),
  rabbitMQMessage: fixture(createRabbitMQMessage),
  rabbitMQEvent: fixture(createRabbitMQEvent),
  rabbitMQHandlerEvent: fixture(createRabbitMQHandlerEvent),
  vpcLatticeV1Event: fixture(createVPCLatticeV1Event),
  vpcLatticeV1HandlerEvent: fixture(createVPCLatticeV1HandlerEvent),
  vpcLatticeV2Event: fixture(createVPCLatticeV2Event),
  vpcLatticeV2HandlerEvent: fixture(createVPCLatticeV2HandlerEvent),
  webSocketEvent: fixture(createWebSocketEvent),
  webSocketHandlerEvent: fixture(createWebSocketHandlerEvent),
  apiGatewayLambdaAuthorizerTokenEvent: fixture(createApiGatewayLambdaAuthorizerTokenEvent),
  apiGatewayLambdaAuthorizerTokenHandlerEvent: fixture(createApiGatewayLambdaAuthorizerTokenHandlerEvent),
  apiGatewayLambdaAuthorizerRequestV1Event: fixture(createApiGatewayLambdaAuthorizerRequestV1Event),
  apiGatewayLambdaAuthorizerRequestV1HandlerEvent: fixture(createApiGatewayLambdaAuthorizerRequestV1HandlerEvent),
  apiGatewayLambdaAuthorizerRequestV2Event: fixture(createApiGatewayLambdaAuthorizerRequestV2Event),
  apiGatewayLambdaAuthorizerRequestV2HandlerEvent: fixture(createApiGatewayLambdaAuthorizerRequestV2HandlerEvent),
  configEvent: fixture(createConfigEvent),
  configHandlerEvent: fixture(createConfigHandlerEvent),
  configurationItem: fixture(createConfigurationItem),
  configurationItemSummary: fixture(createConfigurationItemSummary),
});
