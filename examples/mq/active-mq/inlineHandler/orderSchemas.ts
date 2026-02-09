import { z } from 'zod';

export const orderSchema = z.object({
  orderId: z.string(),
  customerId: z.string(),
  total: z.number(),
  status: z.enum(['pending', 'confirmed', 'shipped', 'delivered']),
  createdAt: z.string(),
});
