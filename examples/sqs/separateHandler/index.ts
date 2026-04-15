import { LambdaRouter } from '@lambda-event-router/base';
import { createSQSRouter, type SQSFilterInput } from '@lambda-event-router/sqs';
import type { Handler } from 'aws-lambda';

import { CreateItemBodySchema, createItem, createItemOther, MessageAttributesSchema } from './createItem.js';

const sqsRouter = createSQSRouter({
  batchItemFailures: true,
});

const SOME_QUEUE_ARN = 'arn:aws:sqs:region:account-id:some-queue';
const SOME_DL_QUEUE_ARN = 'arn:aws:sqs:region:account-id:some-dl-queue';

sqsRouter.route({
  filters: {
    eventSourceArn: [SOME_QUEUE_ARN, SOME_DL_QUEUE_ARN],
  },
  handler: createItemOther,
});

sqsRouter.route({
  filters: {
    eventSourceArn: [SOME_QUEUE_ARN, SOME_DL_QUEUE_ARN],
    messageAttributes: {
      Type: ['ORDER', 'REFUND'],
    },
  },
  handler: createItem,
  bodySchema: CreateItemBodySchema,
  messageAttributesSchema: MessageAttributesSchema,
});

const HIGH_VALUE_THRESHOLD = 1000;

// Custom filter checking parsed body content - messageAttributes can't express value thresholds
function isHighValueOrder({ body }: SQSFilterInput): boolean {
  if (typeof body !== 'object' || body === null || !('total' in body)) return false;
  const { total } = body;
  return typeof total === 'number' && total >= HIGH_VALUE_THRESHOLD;
}

sqsRouter.route({
  filters: {
    eventSourceArn: [SOME_QUEUE_ARN, SOME_DL_QUEUE_ARN],
    customFilter: isHighValueOrder,
  },
  handler: createItem,
  bodySchema: CreateItemBodySchema,
  messageAttributesSchema: MessageAttributesSchema,
});

const lambdaRouter = new LambdaRouter({
  routers: [sqsRouter],
});

export const handler: Handler = lambdaRouter.handler();
