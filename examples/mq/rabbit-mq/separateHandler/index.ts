import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';
import { createRabbitMQRouter, type RabbitMQFilterInput } from '../../../../packages/mq/src/index.js';

import { handleAllMessages, handleJsonMessage, handleOrderMessage, handleQueueMessage } from './handlers.js';

const BROKER_ARN = 'arn:aws:mq:region:account-id:broker:MyRabbitBroker:b-1234-5678-9012';

const rabbitMQRouter = createRabbitMQRouter();

rabbitMQRouter.route({
  filters: {
    eventSourceArn: BROKER_ARN,
  },
  handler: handleAllMessages,
});

rabbitMQRouter.route({
  filters: {
    eventSourceArn: BROKER_ARN,
    queue: 'orders-queue',
  },
  handler: handleQueueMessage,
});

rabbitMQRouter.route({
  filters: {
    eventSourceArn: BROKER_ARN,
    contentType: 'application/json',
  },
  handler: handleJsonMessage,
});

rabbitMQRouter.route({
  filters: {
    eventSourceArn: BROKER_ARN,
    queue: 'orders-queue',
    contentType: 'application/json',
  },
  handler: handleOrderMessage,
});

function isRetryQueue({ queue }: RabbitMQFilterInput): boolean {
  return queue.endsWith('-retry');
}

rabbitMQRouter.route({
  filters: {
    eventSourceArn: BROKER_ARN,
    contentType: 'application/json',
    customFilter: isRetryQueue,
  },
  handler: handleOrderMessage,
});

const lambdaRouter = new LambdaRouter({
  routers: [rabbitMQRouter],
});

export const handler: Handler = lambdaRouter.handler();
