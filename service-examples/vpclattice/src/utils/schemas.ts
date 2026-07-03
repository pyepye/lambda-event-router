import { z } from 'zod';

// Query on GET /stock/:sku. `page` arrives as a string, so it is coerced; a value that will not
// coerce fails the schema and the router answers 400.
export const StockQuerySchema = z.object({
  expand: z.enum(['movements', 'supplier']).optional(),
  depot: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
});

// Body on POST /stock. A missing field fails the schema and the router answers 422.
export const NewStockItemSchema = z.object({
  sku: z.string().min(1),
  description: z.string().min(1),
  quantity: z.number().int().nonnegative(),
});

export const StockItemSchema = z.object({
  sku: z.string(),
  description: z.string(),
  quantity: z.number(),
  depot: z.string(),
});

// Response on GET /stock/available, checked after the handler returns.
export const AvailableStockSchema = z.array(StockItemSchema);

export const StockAdjustmentSchema = z.object({
  delta: z.number().int(),
  reason: z.string().min(1),
});

// Response on GET /reports/valuation. The holding includes a write-off the handler cannot net off,
// so every call to that route returns a total this schema rejects.
export const ValuationSchema = z.object({
  currency: z.literal('GBP'),
  total: z.number().positive(),
});

export const ReorderSchema = z.object({
  sku: z.string().min(1),
  quantity: z.number().int().positive(),
});

export type TStockQuery = z.infer<typeof StockQuerySchema>;
export type TNewStockItem = z.infer<typeof NewStockItemSchema>;
export type TStockAdjustment = z.infer<typeof StockAdjustmentSchema>;
