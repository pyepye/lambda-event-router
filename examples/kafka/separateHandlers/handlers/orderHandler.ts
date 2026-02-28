import type { KafkaRequest, KafkaResponse } from '@lambda-event-router/kafka';
import { z } from 'zod';

export const OrderValueSchema = z.object({
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

type OrderValue = z.infer<typeof OrderValueSchema>;

export async function processOrder(request: KafkaRequest<OrderValue>): Promise<KafkaResponse> {
  const { orderId, customerId, items, total } = request.value;
  console.log(`Processing order ${orderId} for customer ${customerId}: ${items.length} items, total $${total}`);
}
