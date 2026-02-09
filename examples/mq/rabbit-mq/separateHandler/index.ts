import { EventRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';
import { createRabbitMQRouter } from '../../../../packages/mq/src/index.js';

import { handleAllMessages, handleJsonMessage, handleOrderMessage, handleQueueMessage } from './handlers.js';

const BROKER_ARN = 'arn:aws:mq:region:account-id:broker:MyRabbitBroker:b-1234-5678-9012';

const rabbitMQRouter = createRabbitMQRouter();

rabbitMQRouter.route({
  filters: {
    eventSourceArns: [BROKER_ARN],
  },
  handler: handleAllMessages,
});

rabbitMQRouter.route({
  filters: {
    eventSourceArns: [BROKER_ARN],
    queues: ['orders-queue'],
  },
  handler: handleQueueMessage,
});

rabbitMQRouter.route({
  filters: {
    eventSourceArns: [BROKER_ARN],
    contentTypes: ['application/json'],
  },
  handler: handleJsonMessage,
});

rabbitMQRouter.route({
  filters: {
    eventSourceArns: [BROKER_ARN],
    queues: ['orders-queue'],
    contentTypes: ['application/json'],
  },
  handler: handleOrderMessage,
});

const eventRouter = new EventRouter({
  routers: [rabbitMQRouter],
});

export const handler: Handler = eventRouter.handler();
