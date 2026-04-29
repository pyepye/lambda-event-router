import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/dynamodb';

import { DbOrderSchema } from '../utils/schemas.js';
import { type OutboundMessage, sendSQSMessages } from '../utils/sqs.js';

export const orderProcessor = defineRoute({
  filters: {
    eventName: 'INSERT',
    partitionKey: 'ORDER',
  },
  newImageSchema: DbOrderSchema,
}).handle(async (request) => {
  const queueUrl = process.env.QUEUE_URL;
  if (!queueUrl) {
    throw new Error('QUEUE_URL not configured');
  }

  await new Promise((resolve) => setTimeout(resolve, 5000));

  const { sk: orderId, items } = request.newImage;
  logger.info({ message: `Processing ${orderId}` });

  const messages: OutboundMessage[] = items.map((line) => ({
    type: 'decrementStock',
    data: { orderId, sku: line.sku, qty: line.qty },
  }));

  messages.push({
    type: 'sendConfirmationEmail',
    data: { orderId, itemCount: items.length },
  });

  await sendSQSMessages(queueUrl, messages);

  logger.info({
    message: 'Order fanned out',
    orderId,
    decrementCount: items.length,
    confirmationCount: 1,
  });
});
