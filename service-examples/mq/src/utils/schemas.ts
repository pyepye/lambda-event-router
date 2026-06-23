import { z } from 'zod';

// An order placed by the storefront. `total` is published as a string, so the schema is what turns
// it into a number.
export const OrderSchema = z.object({
  orderId: z.string().min(1),
  customer: z.string().min(1),
  total: z.coerce.number().nonnegative(),
  currency: z.enum(['GBP', 'EUR', 'USD']),
});

export type TOrder = z.infer<typeof OrderSchema>;

// A payment taken against an order.
export const PaymentSchema = z.object({
  paymentId: z.string().min(1),
  orderId: z.string().min(1),
  amount: z.coerce.number().positive(),
  method: z.enum(['card', 'bank-transfer']),
});

export type TPayment = z.infer<typeof PaymentSchema>;
