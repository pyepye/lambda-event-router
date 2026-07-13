import { z } from 'zod';

// An order placed by a customer. `total` is a number, so an order without one fails here.
export const OrderSchema = z.object({
  orderId: z.string().min(1),
  customerId: z.string().min(1),
  total: z.number().positive(),
  currency: z.enum(['GBP', 'EUR', 'USD']),
});

export type TOrder = z.infer<typeof OrderSchema>;

// A payment taken against an order.
export const PaymentSchema = z.object({
  paymentId: z.string().min(1),
  orderId: z.string().min(1),
  amount: z.number().positive(),
  method: z.enum(['card', 'bank-transfer']),
});

export type TPayment = z.infer<typeof PaymentSchema>;

// Lambda's own envelope for a record that has used its retries. The order or payment that failed sits
// under `payload.records`, still base64 encoded, so this schema reads the failure rather than the work.
export const FailedRecordSchema = z.object({
  requestContext: z.object({
    condition: z.string(),
    approximateInvokeCount: z.number(),
  }),
  KafkaBatchInfo: z.object({
    eventSourceArn: z.string(),
    batchSize: z.number(),
  }),
});

export type TFailedRecord = z.infer<typeof FailedRecordSchema>;
