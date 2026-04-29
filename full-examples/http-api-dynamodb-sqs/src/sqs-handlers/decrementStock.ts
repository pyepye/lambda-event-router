import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/sqs';

import { decrementStock as decrementStockData } from '../utils/dynamodb.js';
import { DecrementStockMessageSchema } from '../utils/schemas.js';

export const decrementStock = defineRoute({
  filters: {
    messageAttributes: { type: 'decrementStock' },
  },
  bodySchema: DecrementStockMessageSchema,
}).handle(async (request) => {
  const { orderId, sku, qty } = request.body;
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const stock = await decrementStockData(sku, qty);

  logger.info({
    message: 'Stock decremented',
    orderId,
    sku,
    qty,
    remainingQuantity: stock.quantity,
  });
});
