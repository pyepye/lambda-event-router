import type { TestAPI } from 'vitest';
import { test as viTest } from 'vitest';
import type { ActiveMQFixtures } from './activeMQ.js';
import { activeMQFixtures } from './activeMQ.js';
import type { ALBFixtures } from './alb.js';
import { albFixtures } from './alb.js';
import type { ApiGatewayLambdaAuthorizerFixtures } from './apiGatewayLambdaAuthorizer.js';
import { apiGatewayLambdaAuthorizerFixtures } from './apiGatewayLambdaAuthorizer.js';
import type { ApiGatewayV1Fixtures } from './apiGatewayV1.js';
import { apiGatewayV1Fixtures } from './apiGatewayV1.js';
import type { ApiGatewayV2Fixtures } from './apiGatewayV2.js';
import { apiGatewayV2Fixtures } from './apiGatewayV2.js';
import type { AppSyncFixtures } from './appSync.js';
import { appSyncFixtures } from './appSync.js';
import type { CloudWatchLogsFixtures } from './cloudWatchLogs.js';
import { cloudWatchLogsFixtures } from './cloudWatchLogs.js';
import type { CodeCommitFixtures } from './codeCommit.js';
import { codeCommitFixtures } from './codeCommit.js';
import type { CodePipelineFixtures } from './codepipeline.js';
import { codePipelineFixtures } from './codepipeline.js';
import type { CognitoFixtures } from './cognito.js';
import { cognitoFixtures } from './cognito.js';
import type { ConfigFixtures } from './config.js';
import { configFixtures } from './config.js';
import type { ConnectFixtures } from './connect.js';
import { connectFixtures } from './connect.js';
import type { ContextFixtures } from './context.js';
import { contextFixtures } from './context.js';
import type { DocumentDBFixtures } from './documentdb.js';
import { documentDBFixtures } from './documentdb.js';
import type { DynamoDBFixtures } from './dynamodb.js';
import { dynamoDBFixtures } from './dynamodb.js';
import type { EventBridgeFixtures } from './eventbridge.js';
import { eventBridgeFixtures } from './eventbridge.js';
import type { FirehoseFixtures } from './firehose.js';
import { firehoseFixtures } from './firehose.js';
import type { KafkaFixtures } from './kafka.js';
import { kafkaFixtures } from './kafka.js';
import type { KinesisFixtures } from './kinesis.js';
import { kinesisFixtures } from './kinesis.js';
import type { LexFixtures } from './lex.js';
import { lexFixtures } from './lex.js';
import type { RabbitMQFixtures } from './rabbitMQ.js';
import { rabbitMQFixtures } from './rabbitMQ.js';
import type { S3Fixtures } from './s3.js';
import { s3Fixtures } from './s3.js';
import type { SecretsManagerFixtures } from './secretsManager.js';
import { secretsManagerFixtures } from './secretsManager.js';
import type { SESFixtures } from './ses.js';
import { sesFixtures } from './ses.js';
import type { SNSFixtures } from './sns.js';
import { snsFixtures } from './sns.js';
import type { SQSFixtures } from './sqs.js';
import { sqsFixtures } from './sqs.js';
import type { VPCLatticeFixtures } from './vpcLattice.js';
import { vpcLatticeFixtures } from './vpcLattice.js';
import type { WebSocketFixtures } from './webSocket.js';
import { webSocketFixtures } from './webSocket.js';

export type TestFixtures = ActiveMQFixtures &
  ALBFixtures &
  ApiGatewayLambdaAuthorizerFixtures &
  ApiGatewayV1Fixtures &
  ApiGatewayV2Fixtures &
  AppSyncFixtures &
  CloudWatchLogsFixtures &
  CodeCommitFixtures &
  CodePipelineFixtures &
  CognitoFixtures &
  ConfigFixtures &
  ConnectFixtures &
  ContextFixtures &
  DocumentDBFixtures &
  DynamoDBFixtures &
  EventBridgeFixtures &
  FirehoseFixtures &
  KafkaFixtures &
  KinesisFixtures &
  LexFixtures &
  RabbitMQFixtures &
  S3Fixtures &
  SecretsManagerFixtures &
  SESFixtures &
  SNSFixtures &
  SQSFixtures &
  VPCLatticeFixtures &
  WebSocketFixtures;

export const test: TestAPI<TestFixtures> = viTest.extend<TestFixtures>({
  ...activeMQFixtures,
  ...albFixtures,
  ...apiGatewayLambdaAuthorizerFixtures,
  ...apiGatewayV1Fixtures,
  ...apiGatewayV2Fixtures,
  ...appSyncFixtures,
  ...cloudWatchLogsFixtures,
  ...codeCommitFixtures,
  ...codePipelineFixtures,
  ...cognitoFixtures,
  ...configFixtures,
  ...connectFixtures,
  ...contextFixtures,
  ...documentDBFixtures,
  ...dynamoDBFixtures,
  ...eventBridgeFixtures,
  ...firehoseFixtures,
  ...kafkaFixtures,
  ...kinesisFixtures,
  ...lexFixtures,
  ...rabbitMQFixtures,
  ...s3Fixtures,
  ...secretsManagerFixtures,
  ...sesFixtures,
  ...snsFixtures,
  ...sqsFixtures,
  ...vpcLatticeFixtures,
  ...webSocketFixtures,
});
