import { EventRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';
import { createActiveMQRouter } from '../../../../packages/mq/src/index.js';

import { handleAllMessages, handleBytesMessage, handleOrderMessage, handleTextMessage } from './handlers.js';

const BROKER_ARN = 'arn:aws:mq:region:account-id:broker:MyBroker:b-1234-5678-9012';

const activeMQRouter = createActiveMQRouter();

activeMQRouter.route({
  filters: {
    eventSourceArns: [BROKER_ARN],
  },
  handler: handleAllMessages,
});

activeMQRouter.route({
  filters: {
    eventSourceArns: [BROKER_ARN],
    messageTypes: ['jms/text-message'],
  },
  handler: handleTextMessage,
});

activeMQRouter.route({
  filters: {
    eventSourceArns: [BROKER_ARN],
    messageTypes: ['jms/bytes-message'],
  },
  handler: handleBytesMessage,
});

activeMQRouter.route({
  filters: {
    eventSourceArns: [BROKER_ARN],
    destinations: ['orders-queue'],
    messageTypes: ['jms/text-message'],
  },
  handler: handleOrderMessage,
});

// Shorthand methods
activeMQRouter.textMessage({
  filters: {
    eventSourceArns: [BROKER_ARN],
    // messageTypes: ['jms/text-message'], // Not valid filter for .textMessage()
  },
  handler: handleTextMessage,
});

activeMQRouter.bytesMessage({
  filters: {
    eventSourceArns: [BROKER_ARN],
    // messageTypes: ['jms/bytes-message'], // Not valid filter for .bytesMessage()
  },
  handler: handleBytesMessage,
});

const eventRouter = new EventRouter({
  routers: [activeMQRouter],
});

export const handler: Handler = eventRouter.handler();
