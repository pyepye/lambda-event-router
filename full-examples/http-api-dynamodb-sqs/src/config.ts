import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { SQSClient } from '@aws-sdk/client-sqs';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { traceIdInjectionMiddleware } from './utils/traceId/dynamoDBInjection.js';
import { tracer } from './utils/traceId/tracer.js';

const dynamoDBClient = tracer.captureAWSv3Client(new DynamoDBClient());

export const ddb = DynamoDBDocumentClient.from(dynamoDBClient);
ddb.middlewareStack.add(traceIdInjectionMiddleware, {
  step: 'initialize',
  name: 'xrayTraceIdInjection',
});

export const tableName = process.env.TABLE_NAME ?? '';

export const sqs = tracer.captureAWSv3Client(new SQSClient());
