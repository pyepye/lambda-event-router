import { z } from 'zod';

// Both tables use the same key names, because the router's `keys` option names one pair for every
// route. Images are validated after unmarshalling, so an `N` attribute is already a number here and an
// `SS` attribute is already a Set.

// An order summary item. `status` drives the custom filter that separates a status change from any
// other edit.
export const OrderSchema = z
  .object({
    pk: z.string().startsWith('ORDER#'),
    sk: z.literal('SUMMARY'),
    customer: z.string().min(1),
    total: z.number().positive(),
    status: z.enum(['placed', 'packed', 'shipped']),
    tags: z.set(z.string()),
    note: z.string().optional(),
  })
  .transform((order) => ({ ...order, orderId: order.pk.slice('ORDER#'.length) }));

export type TOrder = z.infer<typeof OrderSchema>;

// A payment item hanging off an order.
export const PaymentSchema = z.object({
  pk: z.string().min(1),
  sk: z.string().min(1),
  amount: z.number().positive(),
  cardToken: z.string().min(1),
});

export type TPayment = z.infer<typeof PaymentSchema>;

// The key pair of a payment item, split into the two ids it encodes. A sort key of `PAYMENT#` with no
// reference after it still matches the route's `PAYMENT#*` filter, and fails here.
export const PaymentKeysSchema = z
  .object({
    pk: z.string().startsWith('ORDER#'),
    sk: z.string().regex(/^PAYMENT#.+$/),
  })
  .transform(({ pk, sk }) => ({
    orderId: pk.slice('ORDER#'.length),
    paymentRef: sk.slice('PAYMENT#'.length),
  }));

export type TPaymentKeys = z.infer<typeof PaymentKeysSchema>;

// A customer profile item, written by an upsert, so the same shape arrives on INSERT and on MODIFY.
export const CustomerSchema = z.object({
  pk: z.string().min(1),
  sk: z.literal('PROFILE'),
  email: z.string().min(1),
  marketingOptIn: z.boolean(),
});

export type TCustomer = z.infer<typeof CustomerSchema>;

// The key pair of a search index entry. A KEYS_ONLY stream carries nothing else, so this is the only
// schema its route can have.
export const SearchKeysSchema = z.object({
  pk: z.string().startsWith('PRODUCT#'),
  sk: z.literal('LISTING'),
});

export type TSearchKeys = z.infer<typeof SearchKeysSchema>;
