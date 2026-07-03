import { z } from 'zod';

// Query on GET /returns/:returnId. `page` arrives as a string, so it is coerced; a value that will
// not coerce fails the schema and the router answers 400.
export const ReturnQuerySchema = z.object({
  expand: z.enum(['lines', 'refund']).optional(),
  carrier: z.string().optional(),
  reason: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
});

// Body on POST /returns. A missing field fails the schema and the router answers 422.
export const NewReturnSchema = z.object({
  returnId: z.string().min(1),
  orderId: z.string().min(1),
  units: z.number().int().positive(),
});

export const ReturnRecordSchema = z.object({
  returnId: z.string(),
  orderId: z.string(),
  carrier: z.string(),
  units: z.number(),
  state: z.enum(['open', 'settled']),
});

// Response on GET /returns/open, checked after the handler returns.
export const OpenReturnsSchema = z.array(ReturnRecordSchema);

export const ReturnAmendmentSchema = z.object({
  units: z.number().int(),
  reason: z.string().min(1),
});

// Response on GET /reports/returns. The desk holds more write-offs than settled returns, so every
// call to that route returns a count this schema rejects.
export const ReturnsSummarySchema = z.object({
  currency: z.literal('GBP'),
  settled: z.number().nonnegative(),
});

// Response on GET /reports/returns/queue. The handler returns a count this rejects, wrapped in a
// response of its own, which is the shape the router leaves unvalidated.
export const ReturnQueueSchema = z.object({
  currency: z.literal('GBP'),
  queued: z.number().nonnegative(),
});

export const RefundSchema = z.object({
  returnId: z.string().min(1),
  amount: z.number().positive(),
});

export type TReturnQuery = z.infer<typeof ReturnQuerySchema>;
export type TNewReturn = z.infer<typeof NewReturnSchema>;
export type TReturnAmendment = z.infer<typeof ReturnAmendmentSchema>;
