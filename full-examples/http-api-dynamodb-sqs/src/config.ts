import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { SQSClient } from '@aws-sdk/client-sqs';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export const ddb = DynamoDBDocumentClient.from(new DynamoDBClient());
export const sqs = new SQSClient();

export const TABLE_NAME = process.env.TABLE_NAME ?? '';
export const QUEUE_URL = process.env.QUEUE_URL ?? '';
