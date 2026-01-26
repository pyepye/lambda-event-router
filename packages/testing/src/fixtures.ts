import type {
  APIGatewayProxyEventV2,
  Context,
  DynamoDBRecord,
  DynamoDBStreamEvent,
  S3BatchEvent,
  S3BatchEventTask,
  S3Event,
  S3EventRecord,
  SNSEvent,
  SNSEventRecord,
  SQSEvent,
  SQSRecord,
} from 'aws-lambda';
import { test as viTest } from 'vitest';
import type { ApiEventOverrides, ApiHandlerEvent, CreateApiHandlerEventOptions } from './api.js';
import { createApiEvent, createApiHandlerEvent } from './api.js';
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
  context: (overrides?: Partial<Context>) => Context;
  sqsRecord: (overrides?: SQSRecordOverrides) => SQSRecord;
  sqsEvent: (records?: SQSRecord[]) => SQSEvent;
  sqsHandlerEvent: (options?: CreateSQSHandlerEventOptions) => SQSHandlerEvent;
  snsRecord: (overrides?: SNSRecordOverrides) => SNSEventRecord;
  snsEvent: (records?: SNSEventRecord[]) => SNSEvent;
  snsHandlerEvent: (options?: CreateSNSHandlerEventOptions) => SNSHandlerEvent;
  s3Record: (overrides?: S3RecordOverrides) => S3EventRecord;
  s3Event: (records?: S3EventRecord[]) => S3Event;
  s3HandlerEvent: (options?: CreateS3HandlerEventOptions) => S3HandlerEvent;
  s3BatchTask: (overrides?: Partial<S3BatchEventTask>) => S3BatchEventTask;
  s3BatchEvent: (overrides?: Partial<Omit<S3BatchEvent, 'tasks'>> & { tasks?: S3BatchEventTask[] }) => S3BatchEvent;
  s3BatchHandlerEvent: (options?: CreateS3BatchHandlerEventOptions) => S3BatchHandlerEvent;
  eventBridgeEvent: (overrides?: EventBridgeEventOverrides) => EventBridgeEvent;
  eventBridgeHandlerEvent: (options?: CreateEventBridgeHandlerEventOptions) => EventBridgeHandlerEvent;
  dynamoDBRecord: (overrides?: DynamoDBRecordOverrides) => DynamoDBRecord;
  dynamoDBInsertRecord: (overrides?: DynamoDBRecordOverrides) => DynamoDBRecord;
  dynamoDBModifyRecord: (overrides?: DynamoDBRecordOverrides) => DynamoDBRecord;
  dynamoDBRemoveRecord: (overrides?: DynamoDBRecordOverrides) => DynamoDBRecord;
  dynamoDBStreamEvent: (records?: DynamoDBRecord[]) => DynamoDBStreamEvent;
  dynamoDBStreamHandlerEvent: (options?: CreateDynamoDBStreamHandlerEventOptions) => DynamoDBStreamHandlerEvent;
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
  context: fixture(createMockContext),
  sqsRecord: fixture(createSQSRecord),
  sqsEvent: fixture(createSQSEvent),
  sqsHandlerEvent: fixture(createSQSHandlerEvent),
  snsRecord: fixture(createSNSRecord),
  snsEvent: fixture(createSNSEvent),
  snsHandlerEvent: fixture(createSNSHandlerEvent),
  s3Record: fixture(createS3Record),
  s3Event: fixture(createS3Event),
  s3HandlerEvent: fixture(createS3HandlerEvent),
  s3BatchTask: fixture(createS3BatchTask),
  s3BatchEvent: fixture(createS3BatchEvent),
  s3BatchHandlerEvent: fixture(createS3BatchHandlerEvent),
  // Need different eventBridge fixtures to handle the different types
  eventBridgeEvent: fixture(createEventBridgeEvent),
  eventBridgeHandlerEvent: fixture(createEventBridgeHandlerEvent),
  dynamoDBRecord: fixture(createDynamoDBRecord),
  dynamoDBInsertRecord: fixture(createDynamoDBInsertRecord),
  dynamoDBModifyRecord: fixture(createDynamoDBModifyRecord),
  dynamoDBRemoveRecord: fixture(createDynamoDBRemoveRecord),
  dynamoDBStreamEvent: fixture(createDynamoDBStreamEvent),
  dynamoDBStreamHandlerEvent: fixture(createDynamoDBStreamHandlerEvent),
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
