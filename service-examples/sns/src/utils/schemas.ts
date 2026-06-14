import { z } from 'zod';

// An order placed by a customer. `shippingSpeed` drives the custom filter that expedites orders.
export const OrderSchema = z.object({
  orderId: z.string().min(1),
  customer: z.string().min(1),
  total: z.number().positive(),
  shippingSpeed: z.enum(['standard', 'express']).default('standard'),
});

export type TOrder = z.infer<typeof OrderSchema>;

// Message attributes published alongside an order. `eventType` drives the messageAttributes filter.
// The rest show what the schema has to do with each published type. SNS delivers a Number as its
// digits and a String.Array as its JSON text, so both need coercing here; only Binary arrives as a
// Buffer. `priority` is the only attribute a message can fail validation on, because the filter never
// reads it. Sent as a word rather than a digit, the record fails.
export const OrderAttributesSchema = z.object({
  eventType: z.literal('OrderPlaced'),
  priority: z.coerce.number().int().min(1).max(5),
  warehouses: z
    .string()
    .transform((value) => z.array(z.string()).parse(JSON.parse(value)))
    .optional(),
  checksum: z.instanceof(Buffer).optional(),
});

export type TOrderAttributes = z.infer<typeof OrderAttributesSchema>;

// A cancellation, picked out by the SNS subject rather than by a message attribute.
export const CancellationSchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().min(1),
});

// A card payment request. The handler that takes these always throws.
export const PaymentSchema = z.object({
  orderId: z.string().min(1),
  amount: z.number().positive(),
  cardLast4: z.string().length(4),
});

// A stock reservation on the inventory topic.
export const StockMovementSchema = z.object({
  sku: z.string().min(1),
  orderId: z.string().min(1),
  quantity: z.number().int().positive(),
});
