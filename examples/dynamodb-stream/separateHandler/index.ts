import type { Handler } from 'aws-lambda';

import { EventRouter } from '@lambda-event-router/base';
import { createDynamoDBStreamRouter } from '@lambda-event-router/dynamodb-stream';

import { createItem, modifyItem, removeItem, updateItem } from './createItem.js';

const dynamodbStreamRouter = createDynamoDBStreamRouter({
  batchItemFailures: true,
});

const SOME_QUEUE_ARN = 'arn:aws:dynamodb-stream:region:account-id:some-stream';

dynamodbStreamRouter.route({
  filters: {
    eventSourceArns: [SOME_QUEUE_ARN],
    eventNames: ['INSERT'],
  },
  handler: createItem,
});

dynamodbStreamRouter.route({
  filters: {
    eventSourceArns: [SOME_QUEUE_ARN],
    eventNames: ['MODIFY'],
  },
  handler: updateItem,
});

dynamodbStreamRouter.route({
  filters: {
    eventSourceArns: [SOME_QUEUE_ARN],
    eventNames: ['REMOVE'],
  },
  handler: updateItem,
});

dynamodbStreamRouter.route({
  filters: {
    eventSourceArns: [SOME_QUEUE_ARN],
    streamViewTypes: ['NEW_AND_OLD_IMAGES'],
  },
  handler: updateItem,
});

dynamodbStreamRouter.insert({
  filters: {
    eventSourceArns: [SOME_QUEUE_ARN],
    // eventNames: ['INSERT'], // Not valid filter for .insert() etc
  },
  handler: createItem,
});

dynamodbStreamRouter.modify({
  filters: {
    eventSourceArns: [SOME_QUEUE_ARN],
  },
  handler: modifyItem,
});

dynamodbStreamRouter.remove({
  filters: {
    eventSourceArns: [SOME_QUEUE_ARN],
  },
  handler: removeItem,
});

const eventRouter = new EventRouter({
  routers: [dynamodbStreamRouter],
});

export const handler: Handler = eventRouter.handler();
