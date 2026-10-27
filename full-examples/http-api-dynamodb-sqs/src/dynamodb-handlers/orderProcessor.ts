import { logger } from '@latcher/base';
import { defineRoute } from '@latcher/dynamodb';

import { markOrderProcessed } from '../utils/dynamodb.js';
import { DbOrderToOrder } from '../utils/schemas.js';
import { type OutboundMessage, sendSQSMessages } from '../utils/sqs.js';

export const orderProcessor = defineRoute({
  filters: {
    eventName: 'INSERT',
    partitionKey: 'ORDER#*',
  },
  newImageSchema: DbOrderToOrder,
}).handle(async (request) => {
  const { orderId, items } = request.newImage;

  const messages: OutboundMessage[] = [
    ...items.map((line) => ({
      type: 'decrementStock',
      data: { orderId, sku: line.sku, qty: line.qty },
    })),
    {
      type: 'sendConfirmationEmail',
      data: { orderId, itemCount: items.length },
    },
  ];

  await sendSQSMessages(messages);
  await markOrderProcessed(orderId);

  logger.info({ message: 'Order processed', orderId, messageCount: messages.length });
});
