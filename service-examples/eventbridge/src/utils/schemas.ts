import { z } from 'zod';

// A placed order. `amount` also drives the custom filter that picks out high value orders.
export const OrderPlacedSchema = z.object({
  orderRef: z.string().min(1),
  customerId: z.string().min(1),
  amount: z.number().int().positive(),
  currency: z.enum(['GBP', 'EUR', 'USD']),
});

export type TOrderPlaced = z.infer<typeof OrderPlacedSchema>;

export const OrderUpdatedSchema = z.object({
  orderRef: z.string().min(1),
  status: z.enum(['picking', 'packed', 'cancelled']),
});

export type TOrderUpdated = z.infer<typeof OrderUpdatedSchema>;

export const ShipmentSchema = z.object({
  orderRef: z.string().min(1),
  carrier: z.string().min(1),
  trackingRef: z.string().min(1),
});

export type TShipment = z.infer<typeof ShipmentSchema>;

export const PaymentCapturedSchema = z.object({
  orderRef: z.string().min(1),
  paymentRef: z.string().min(1),
  amount: z.number().int().positive(),
});

export type TPaymentCaptured = z.infer<typeof PaymentCapturedSchema>;
