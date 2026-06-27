import { z } from 'zod';

// Query on GET /orders/:orderId. `page` arrives as a string, so it is coerced; a value that will
// not coerce fails the schema and the router answers 400.
export const OrderQuerySchema = z.object({
  include: z.enum(['lines', 'history']).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

// Body on POST /orders. A missing field fails the schema and the router answers 422.
export const NewOrderSchema = z.object({
  reference: z.string().min(1),
  customer: z.string().min(1),
  total: z.number().positive(),
});

// Response on POST /orders, checked after the handler returns.
export const OrderSchema = z.object({
  orderId: z.string(),
  reference: z.string(),
  customer: z.string(),
  status: z.enum(['pending', 'packed', 'dispatched']),
  total: z.number(),
});

export const OrderAmendmentSchema = z.object({
  status: z.enum(['pending', 'packed', 'dispatched']),
});

// Response on GET /dispatch/quote. The carrier answers with a price the handler cannot make
// positive, so every call to that route fails this schema.
export const CarrierQuoteSchema = z.object({
  carrier: z.string(),
  price: z.number().positive(),
});

export const ConsignmentBookingSchema = z.object({
  consignmentId: z.string().min(1),
  carrier: z.enum(['palletline', 'nightfreight']),
  weightKg: z.number().positive(),
});

export const StockAdjustmentSchema = z.object({
  delta: z.number().int(),
  reason: z.string().min(1),
});

// Body of a sendAlert frame on the WebSocket API.
export const StockAlertSchema = z.object({
  action: z.literal('sendAlert'),
  sku: z.string().min(1),
  message: z.string().min(1),
});

export type TStockAlert = z.infer<typeof StockAlertSchema>;
export type TOrderQuery = z.infer<typeof OrderQuerySchema>;
export type TNewOrder = z.infer<typeof NewOrderSchema>;
export type TOrderAmendment = z.infer<typeof OrderAmendmentSchema>;
export type TConsignmentBooking = z.infer<typeof ConsignmentBookingSchema>;
export type TStockAdjustment = z.infer<typeof StockAdjustmentSchema>;
