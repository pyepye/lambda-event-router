import { logger } from '@latcher/base';
import { defineRoute } from '@latcher/sqs';

import { removeStock } from '../utils/dynamodb.js';
import { DecrementStockMessageSchema } from '../utils/schemas.js';

export const decrementStock = defineRoute({
  filters: {
    messageAttributes: { type: 'decrementStock' },
  },
  bodySchema: DecrementStockMessageSchema,
}).handle(async (request) => {
  const { orderId, sku, qty } = request.body;

  const stock = await removeStock(sku, qty);

  // A retry cannot create stock, so the message is logged and not retried.
  if (!stock) {
    logger.warn({ message: 'Not enough stock', orderId, sku, qty });
    return;
  }

  logger.info({
    message: 'Stock decremented',
    orderId,
    sku,
    qty,
    remainingQuantity: stock.quantity,
  });
});
