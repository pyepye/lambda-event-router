import { SQSClient } from '@aws-sdk/client-sqs';

export const sqsClient = new SQSClient();

// The eventSourceArn filters match against these. CDK injects them as env vars on the worker.
export const NOTIFICATIONS_QUEUE_ARN = process.env.NOTIFICATIONS_QUEUE_ARN ?? '';
export const PRIORITY_QUEUE_ARN = process.env.PRIORITY_QUEUE_ARN ?? '';
