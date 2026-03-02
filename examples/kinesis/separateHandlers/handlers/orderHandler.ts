import type { KinesisRequest } from '@lambda-event-router/kinesis';
import { z } from 'zod';

export const OrderDataSchema = z.object({
  orderId: z.string(),
  customerId: z.string(),
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number(),
      price: z.number(),
    }),
  ),
  total: z.number(),
});

type OrderData = z.infer<typeof OrderDataSchema>;

export async function processOrder(request: KinesisRequest<OrderData>): Promise<void> {
  const { orderId, customerId, items, total } = request.data;
  const { awsRequestId } = request.context;
  const { eventSourceARN } = request.record;

  const itemSummaries = items.map((item) => ({
    productId: item.productId,
    lineTotal: item.quantity * item.price,
  }));

  const calculatedTotal = itemSummaries.reduce((sum, item) => sum + item.lineTotal, 0);
  const totalMismatch = Math.abs(calculatedTotal - total) > 0.01;

  console.log('Processing order', {
    orderId,
    customerId,
    itemSummaries,
    calculatedTotal,
    totalMismatch,
    traceId: awsRequestId,
    sourceArn: eventSourceARN,
  });
}
