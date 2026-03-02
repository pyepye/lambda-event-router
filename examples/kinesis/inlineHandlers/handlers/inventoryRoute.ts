import { defineRoute } from '@lambda-event-router/kinesis';
import { z } from 'zod';

const InventoryDataSchema = z.object({
  productId: z.string(),
  warehouseId: z.string(),
  quantityChange: z.number(),
  reason: z.enum(['SALE', 'RESTOCK', 'ADJUSTMENT', 'RETURN']),
});

const LOW_STOCK_THRESHOLD = 10;
const CURRENT_STOCK_LEVEL = 50;

export const inventoryRoute = defineRoute({
  filters: {
    partitionKeys: ['inventory-updates'],
  },
  dataSchema: InventoryDataSchema,
}).handle(async ({ data, sequenceNumber }) => {
  const { productId, warehouseId, quantityChange, reason } = data;

  const adjustmentSign = reason === 'RESTOCK' || reason === 'RETURN' ? 1 : -1;
  const newLevel = CURRENT_STOCK_LEVEL + quantityChange * adjustmentSign;
  const lowStock = newLevel < LOW_STOCK_THRESHOLD;
  const idempotencyKey = `${productId}-${warehouseId}-${sequenceNumber}`;

  console.log('Processing inventory update', {
    idempotencyKey,
    productId,
    warehouseId,
    previousLevel: CURRENT_STOCK_LEVEL,
    newLevel,
    lowStock,
    reason,
  });
});
