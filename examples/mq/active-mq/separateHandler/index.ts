import type { Handler } from 'aws-lambda';

import { LambdaRouter } from '@lambda-event-router/base';

import { type ActiveMQFilterInput, createActiveMQRouter } from '../../../../packages/mq/src/index.js';
import { handleAllMessages, handleBytesMessage, handleOrderMessage, handleTextMessage } from './handlers.js';

const BROKER_ARN = 'arn:aws:mq:region:account-id:broker:MyBroker:b-1234-5678-9012';

const activeMQRouter = createActiveMQRouter();

activeMQRouter.route({
  filters: {
    eventSourceArn: BROKER_ARN,
  },
  handler: handleAllMessages,
});

activeMQRouter.route({
  filters: {
    eventSourceArn: BROKER_ARN,
    messageType: 'jms/text-message',
  },
  handler: handleTextMessage,
});

activeMQRouter.route({
  filters: {
    eventSourceArn: BROKER_ARN,
    messageType: 'jms/bytes-message',
  },
  handler: handleBytesMessage,
});

activeMQRouter.route({
  filters: {
    eventSourceArn: BROKER_ARN,
    destination: 'orders-queue',
    messageType: 'jms/text-message',
  },
  handler: handleOrderMessage,
});

// Shorthand methods
activeMQRouter.textMessage({
  filters: {
    eventSourceArn: BROKER_ARN,
    // messageType: 'jms/text-message', // Not valid filter for .textMessage()
  },
  handler: handleTextMessage,
});

activeMQRouter.bytesMessage({
  filters: {
    eventSourceArn: BROKER_ARN,
    // messageType: 'jms/bytes-message', // Not valid filter for .bytesMessage()
  },
  handler: handleBytesMessage,
});

function isPriorityDestination({ destination }: ActiveMQFilterInput): boolean {
  return destination.startsWith('priority-');
}

activeMQRouter.textMessage({
  filters: {
    eventSourceArn: BROKER_ARN,
    custom: isPriorityDestination,
  },
  handler: handleOrderMessage,
});

const lambdaRouter = new LambdaRouter({
  routers: [activeMQRouter],
});

export const handler: Handler = lambdaRouter.handler();
