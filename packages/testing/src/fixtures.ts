import type {
  APIGatewayProxyEventV2,
  CloudWatchLogsEvent,
  ConnectContactFlowEvent,
  Context,
  DynamoDBRecord,
  DynamoDBStreamEvent,
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
  AmazonConnectEventOverrides,
  AmazonConnectHandlerEvent,
  CreateAmazonConnectHandlerEventOptions,
} from './amazonConnect.js';
import { createAmazonConnectEvent, createAmazonConnectHandlerEvent } from './amazonConnect.js';
import type { ApiEventOverrides, ApiHandlerEvent, CreateApiHandlerEventOptions } from './api.js';
import { createApiEvent, createApiHandlerEvent } from './api.js';
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
import { createMockContext } from './context.js';
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
import type {
  CreateDynamoDBStreamHandlerEventOptions,
  DynamoDBRecordOverrides,
  DynamoDBStreamHandlerEvent,
} from './dynamodbStream.js';
import {
  createDynamoDBInsertRecord,
  createDynamoDBModifyRecord,
  createDynamoDBRecord,
  createDynamoDBRemoveRecord,
  createDynamoDBStreamEvent,
  createDynamoDBStreamHandlerEvent,
} from './dynamodbStream.js';
import type {
  CreateEventBridgeHandlerEventOptions,
  EventBridgeEvent,
  EventBridgeEventOverrides,
  EventBridgeHandlerEvent,
} from './eventbridge.js';
import { createEventBridgeEvent, createEventBridgeHandlerEvent } from './eventbridge.js';
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

function fixture<T>(creator: T) {
  return async ({ task }: { task: unknown }, use: (value: T) => Promise<void>): Promise<void> => {
    void task;
    await use(creator);
  };
}

export interface TestFixtures {
  amazonConnectEvent: (overrides?: AmazonConnectEventOverrides) => ConnectContactFlowEvent;
  amazonConnectHandlerEvent: (options?: CreateAmazonConnectHandlerEventOptions) => AmazonConnectHandlerEvent;
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
  dynamoDBStreamHandlerEvent: (options?: CreateDynamoDBStreamHandlerEventOptions) => DynamoDBStreamHandlerEvent;
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
  codeCommitReference: (overrides?: CodeCommitReferenceOverrides) => CodeCommitReference;
  codeCommitRecord: (overrides?: CodeCommitRecordOverrides) => CodeCommitRecord;
  codeCommitEvent: (records?: CodeCommitRecord[]) => CodeCommitEvent;
  codeCommitHandlerEvent: (options?: CreateCodeCommitHandlerEventOptions) => CodeCommitHandlerEvent;
  cloudWatchLogsEvent: (overrides?: CloudWatchLogsEventOverrides) => CloudWatchLogsEvent;
  cloudWatchLogsHandlerEvent: (options?: CreateCloudWatchLogsHandlerEventOptions) => CloudWatchLogsHandlerEvent;
  apiEvent: (overrides?: ApiEventOverrides) => APIGatewayProxyEventV2;
  apiHandlerEvent: (options?: CreateApiHandlerEventOptions) => ApiHandlerEvent;
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
}

export const test: ReturnType<typeof viTest.extend<TestFixtures>> = viTest.extend<TestFixtures>({
  amazonConnectEvent: fixture(createAmazonConnectEvent),
  amazonConnectHandlerEvent: fixture(createAmazonConnectHandlerEvent),
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
  dynamoDBStreamEvent: fixture(createDynamoDBStreamEvent),
  dynamoDBStreamHandlerEvent: fixture(createDynamoDBStreamHandlerEvent),
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
  apiEvent: fixture(createApiEvent),
  apiHandlerEvent: fixture(createApiHandlerEvent),
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
});
