import { z } from 'zod';

import { CHARGE_PAYMENT_TASK, FRAUD_REVIEW_TASK, RELEASE_STOCK_HOLD_TASK, RESERVE_STOCK_TASK } from '../config.js';

// A stock reservation for one line of an order.
export const ReserveStockSchema = z.object({
  task: z.literal(RESERVE_STOCK_TASK),
  orderId: z.string().min(1),
  sku: z.string().min(1),
  quantity: z.number().int().positive(),
});

export type TReserveStock = z.infer<typeof ReserveStockSchema>;

// A card capture. `amountPence` is a number, so a priced-in-words order fails here.
export const ChargePaymentSchema = z.object({
  task: z.literal(CHARGE_PAYMENT_TASK),
  orderId: z.string().min(1),
  amountPence: z.number().int().positive(),
  currency: z.enum(['GBP', 'EUR']),
});

export type TChargePayment = z.infer<typeof ChargePaymentSchema>;

// A fraud review payload with the TaskToken already removed by the router.
export const FraudReviewSchema = z.object({
  task: z.literal(FRAUD_REVIEW_TASK),
  orderId: z.string().min(1),
  riskScore: z.number().int().min(0).max(100),
});

export type TFraudReview = z.infer<typeof FraudReviewSchema>;

// Releasing a reservation that a later step no longer needs.
export const ReleaseStockHoldSchema = z.object({
  task: z.literal(RELEASE_STOCK_HOLD_TASK),
  orderId: z.string().min(1),
  reservationId: z.string().min(1),
});

export type TReleaseStockHold = z.infer<typeof ReleaseStockHoldSchema>;
