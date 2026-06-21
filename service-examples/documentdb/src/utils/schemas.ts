import { z } from 'zod';

// DocumentDB sends BSON as extended JSON, so an ObjectId arrives as { $oid: '...' }.
export const ObjectIdSchema = z.object({ $oid: z.string() });

export const DocumentKeySchema = z.object({ _id: ObjectIdSchema });

export type TDocumentKey = z.infer<typeof DocumentKeySchema>;

// Money is stored as a string, so z.coerce hands the handler a number.
export const OrderSchema = z.object({
  _id: ObjectIdSchema,
  reference: z.string().min(1),
  customer: z.string().min(1),
  total: z.coerce.number().nonnegative(),
  status: z.enum(['placed', 'discounted', 'confirmed']),
});

export type TOrder = z.infer<typeof OrderSchema>;

export const InvoiceSchema = z.object({
  _id: ObjectIdSchema,
  orderReference: z.string().min(1),
  amount: z.coerce.number().nonnegative(),
});

export type TInvoice = z.infer<typeof InvoiceSchema>;

export const ProductSchema = z.object({
  _id: ObjectIdSchema,
  sku: z.string().min(1),
  name: z.string().min(1),
  price: z.coerce.number().nonnegative(),
});

export type TProduct = z.infer<typeof ProductSchema>;

export const PaymentSchema = z.object({
  _id: ObjectIdSchema,
  orderReference: z.string().min(1),
  amount: z.coerce.number().nonnegative(),
});

export type TPayment = z.infer<typeof PaymentSchema>;

export const ShipmentSchema = z.object({
  _id: ObjectIdSchema,
  orderReference: z.string().min(1),
  carrier: z.string().min(1),
});

export type TShipment = z.infer<typeof ShipmentSchema>;

export const StockLevelSchema = z.object({ _id: ObjectIdSchema, onHand: z.coerce.number().int() });

export type TStockLevel = z.infer<typeof StockLevelSchema>;

export const PriceHistorySchema = z.object({
  _id: ObjectIdSchema,
  sku: z.string().min(1),
  price: z.coerce.number().nonnegative(),
});

export type TPriceHistory = z.infer<typeof PriceHistorySchema>;
