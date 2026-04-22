import type { Handler } from 'aws-lambda';

import { LambdaRouter } from '@lambda-event-router/base';
import { createDynamoDBRouter, type DynamoDBFilterInput } from '@lambda-event-router/dynamodb';

import { createItem, modifyItem, removeItem, updateItem } from './createItem.js';

const dynamodbStreamRouter = createDynamoDBRouter({
  batchItemFailures: true,
});

const SOME_QUEUE_ARN = 'arn:aws:dynamodb:region:account-id:some-stream';

dynamodbStreamRouter.route({
  filters: {
    eventSourceArn: SOME_QUEUE_ARN,
    eventName: 'INSERT',
  },
  handler: createItem,
});

dynamodbStreamRouter.route({
  filters: {
    eventSourceArn: SOME_QUEUE_ARN,
    eventName: 'MODIFY',
  },
  handler: updateItem,
});

dynamodbStreamRouter.route({
  filters: {
    eventSourceArn: SOME_QUEUE_ARN,
    eventName: 'REMOVE',
  },
  handler: updateItem,
});

dynamodbStreamRouter.route({
  filters: {
    eventSourceArn: SOME_QUEUE_ARN,
    streamViewType: 'NEW_AND_OLD_IMAGES',
  },
  handler: updateItem,
});

dynamodbStreamRouter.insert({
  filters: {
    eventSourceArn: SOME_QUEUE_ARN,
    // eventName: 'INSERT', // Not valid filter for .insert() etc
  },
  handler: createItem,
});

dynamodbStreamRouter.modify({
  filters: {
    eventSourceArn: SOME_QUEUE_ARN,
  },
  handler: modifyItem,
});

dynamodbStreamRouter.remove({
  filters: {
    eventSourceArn: SOME_QUEUE_ARN,
  },
  handler: removeItem,
});

function isFromUsersTable({ record }: DynamoDBFilterInput): boolean {
  const eventSourceArn = record.eventSourceARN ?? '';
  return eventSourceArn.includes('users-table');
}

dynamodbStreamRouter.insert({
  filters: {
    eventSourceArn: SOME_QUEUE_ARN,
    customFilter: isFromUsersTable,
  },
  handler: createItem,
});

const lambdaRouter = new LambdaRouter({
  routers: [dynamodbStreamRouter],
});

export const handler: Handler = lambdaRouter.handler();
