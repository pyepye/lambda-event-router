import { z } from 'zod';

// An order placed through the checkout. `total` is a JSON number in the record, so it arrives as a
// number and needs no coercion.
export const OrderSchema = z.object({
  runId: z.string().min(1),
  orderId: z.string().min(1),
  customer: z.string().min(1),
  total: z.number().positive(),
  currency: z.enum(['GBP', 'EUR']),
});

export type TOrder = z.infer<typeof OrderSchema>;

// A single reading from a field device.
export const ReadingSchema = z.object({
  runId: z.string().min(1),
  deviceId: z.string().min(1),
  metric: z.enum(['temperature', 'humidity']),
  value: z.number(),
});

export type TReading = z.infer<typeof ReadingSchema>;
