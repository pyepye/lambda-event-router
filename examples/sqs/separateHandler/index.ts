import type { Handler } from 'aws-lambda';

import { EventRouter } from '@lambda-event-router/base';
import { type SQSFilterInput, createSQSRouter } from '@lambda-event-router/sqs';

import { CreateItemBodySchema, MessageAttributesSchema, createItem, createItemOther } from './createItem.js';

const sqsRouter = createSQSRouter({
  batchItemFailures: true,
});

const SOME_QUEUE_ARN = 'arn:aws:sqs:region:account-id:some-queue';
const SOME_DL_QUEUE_ARN = 'arn:aws:sqs:region:account-id:some-dl-queue';

sqsRouter.route({
  filters: {
    eventSourceArns: [SOME_QUEUE_ARN, SOME_DL_QUEUE_ARN],
  },
  handler: createItemOther,
});

sqsRouter.route({
  filters: {
    eventSourceArns: [SOME_QUEUE_ARN, SOME_DL_QUEUE_ARN],
    messageAttributes: {
      Type: ['ORDER', 'REFUND'],
    },
  },
  handler: createItem,
  bodySchema: CreateItemBodySchema,
  messageAttributesSchema: MessageAttributesSchema,
});

function isHighPriority({ messageAttributes }: SQSFilterInput): boolean {
  return messageAttributes.Priority === 'HIGH';
}

sqsRouter.route({
  filters: {
    eventSources: [SOME_QUEUE_ARN, SOME_DL_QUEUE_ARN],
    customFilter: isHighPriority,
  },
  handler: createItem,
  bodySchema: CreateItemBodySchema,
  messageAttributesSchema: MessageAttributesSchema,
});

const eventRouter = new EventRouter({
  routers: [sqsRouter],
});

export const handler: Handler = eventRouter.handler();
