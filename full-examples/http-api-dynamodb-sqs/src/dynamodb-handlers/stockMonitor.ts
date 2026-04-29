import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/dynamodb';

import { DbStockSchema } from '../utils/schemas.js';

export const stockMonitor = defineRoute({
  filters: {
    eventName: 'MODIFY',
    partitionKey: 'STOCK',
  },
  newImageSchema: DbStockSchema,
  oldImageSchema: DbStockSchema,
}).handle(async (request) => {
  const { sk: sku, quantity, lowStockThreshold } = request.newImage;
  await new Promise((resolve) => setTimeout(resolve, 5000));
  logger.info({ message: 'Stock level changed', sku, quantity });

  if (quantity <= lowStockThreshold) {
    logger.warn({ message: 'Low stock', sku, quantity, lowStockThreshold });
  }
});
