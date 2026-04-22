import { z } from 'zod';

import { type FirehoseRequest, type FirehoseResponse, Ok } from '@lambda-event-router/firehose';

export const InventoryDataSchema = z.object({
  productId: z.string(),
  warehouseId: z.string(),
  quantityChange: z.number(),
  reason: z.enum(['SALE', 'RESTOCK', 'ADJUSTMENT', 'RETURN']),
});

type InventoryData = z.infer<typeof InventoryDataSchema>;

export async function handleKinesisSource(request: FirehoseRequest<InventoryData>): Promise<FirehoseResponse> {
  const { productId, warehouseId, quantityChange, reason } = request.data;
  const { metadata, recordId, context } = request;

  const partitionKey = metadata?.partitionKey ?? 'unknown';
  const sequenceNumber = metadata?.sequenceNumber ?? 'unknown';
  const idempotencyKey = `${productId}-${warehouseId}-${sequenceNumber}`;

  const adjustmentSign = reason === 'RESTOCK' || reason === 'RETURN' ? 1 : -1;
  const adjustedQuantity = quantityChange * adjustmentSign;

  const enrichedRecord = {
    productId,
    warehouseId,
    adjustedQuantity,
    reason,
    idempotencyKey,
    sourcePartitionKey: partitionKey,
    recordId,
    traceId: context.awsRequestId,
  };

  // Ok(data) auto-stringifies and base64-encodes the transformed data
  return Ok(enrichedRecord);
}
