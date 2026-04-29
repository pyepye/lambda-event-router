import z from 'zod';

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
  pk: z.literal('ORDER'),
  sk: z.string(),
});

export type TDbOrder = z.infer<typeof DbOrderSchema>;

export const DbOrderToOrder = DbOrderSchema.transform((row) => ({
  orderId: row.sk,
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
  pk: z.literal('STOCK'),
  sk: z.string(),
});

export type TDbStock = z.infer<typeof DbStockSchema>;

export const DbStockToStock = DbStockSchema.transform((row) => ({
  sku: row.sk,
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
