import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/dynamodb';

import { DbStockToStock } from '../utils/schemas.js';

export const stockMonitor = defineRoute({
  filters: {
    eventName: 'MODIFY',
    partitionKey: 'STOCK#*',
  },
  newImageSchema: DbStockToStock,
  oldImageSchema: DbStockToStock,
}).handle(async (request) => {
  const { sku, quantity, lowStockThreshold } = request.newImage;
  const previousQuantity = request.oldImage.quantity;

  logger.info({ message: 'Stock level changed', sku, previousQuantity, quantity });

  if (previousQuantity > lowStockThreshold && quantity <= lowStockThreshold) {
    logger.warn({ message: 'Low stock', sku, quantity, lowStockThreshold });
  }
});
