import type { Handler } from 'aws-lambda';

import { LambdaRouter } from '@lambda-event-router/base';
import { createSNSRouter, type SNSFilterInput } from '@lambda-event-router/sns';

import { CreateItemBodySchema, createItem, createItemOther, MessageAttributesSchema } from './createItem.js';

const snsRouter = createSNSRouter();

const SOME_TOPIC_ARN = 'arn:aws:sns:region:account-id:some-topic';
const SOME_DL_TOPIC_ARN = 'arn:aws:sns:region:account-id:some-dl-topic';

// Simple route with topicArns filter only
snsRouter.route({
  filters: {
    topicArn: [SOME_TOPIC_ARN, SOME_DL_TOPIC_ARN],
  },
  handler: createItemOther,
});

// Route with topicArns and subjects filtering
snsRouter.route({
  filters: {
    topicArn: [SOME_TOPIC_ARN],
    subject: ['order-created', 'order-updated'],
  },
  handler: createItem,
  bodySchema: CreateItemBodySchema,
  messageAttributesSchema: MessageAttributesSchema,
});

// Route with topicArns and messageAttributes filtering
snsRouter.route({
  filters: {
    topicArn: [SOME_TOPIC_ARN, SOME_DL_TOPIC_ARN],
    messageAttributes: {
      Type: ['ORDER', 'REFUND'],
    },
  },
  handler: createItem,
  bodySchema: CreateItemBodySchema,
  messageAttributesSchema: MessageAttributesSchema,
});

function isHighPriority({ messageAttributes }: SNSFilterInput): boolean {
  return messageAttributes.Priority === 'HIGH';
}

// Route with custom filter for complex logic
snsRouter.route({
  filters: {
    topicArn: [SOME_TOPIC_ARN, SOME_DL_TOPIC_ARN],
    custom: isHighPriority,
  },
  handler: createItem,
  bodySchema: CreateItemBodySchema,
  messageAttributesSchema: MessageAttributesSchema,
});

const lambdaRouter = new LambdaRouter({
  routers: [snsRouter],
});

export const handler: Handler = lambdaRouter.handler();
