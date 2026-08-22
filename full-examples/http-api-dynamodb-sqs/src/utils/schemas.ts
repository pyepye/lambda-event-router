import z from 'zod';

export const ORDER_PREFIX = 'ORDER#';
export const STOCK_PREFIX = 'STOCK#';

export const OrderLineSchema = z.object({
  sku: z.string().min(1),
  qty: z.number().int().positive(),
});

export type TOrderLine = z.infer<typeof OrderLineSchema>;

export const OrderRequestSchema = z.object({
  items: z.array(OrderLineSchema).min(1),
});

export const OrderSchema = z.object({
  orderId: z.string().min(1),
  items: z.array(OrderLineSchema).min(1),
  status: z.enum(['pending', 'processed']),
  createdAt: z.string(),
});

export type TOrder = z.infer<typeof OrderSchema>;

export const DbOrderSchema = OrderSchema.omit({ orderId: true }).extend({
  pk: z.string().startsWith(ORDER_PREFIX),
  sk: z.literal('ORDER'),
});

export type TDbOrder = z.infer<typeof DbOrderSchema>;

export const DbOrderToOrder = DbOrderSchema.transform((row) => ({
  orderId: row.pk.slice(ORDER_PREFIX.length),
  items: row.items,
  status: row.status,
  createdAt: row.createdAt,
}));

export const StockSchema = z.object({
  sku: z.string().min(1),
  quantity: z.number().int(),
  lowStockThreshold: z.number().int().nonnegative(),
});

export type TStock = z.infer<typeof StockSchema>;

export const DbStockSchema = StockSchema.omit({ sku: true }).extend({
  pk: z.string().startsWith(STOCK_PREFIX),
  sk: z.literal('STOCK'),
});

export const DbStockToStock = DbStockSchema.transform((row) => ({
  sku: row.pk.slice(STOCK_PREFIX.length),
  quantity: row.quantity,
  lowStockThreshold: row.lowStockThreshold,
}));

export const DecrementStockMessageSchema = z.object({
  orderId: z.string().min(1),
  sku: z.string().min(1),
  qty: z.number().int().positive(),
});

export const ConfirmationEmailMessageSchema = z.object({
  orderId: z.string().min(1),
  itemCount: z.number().int().nonnegative(),
});
