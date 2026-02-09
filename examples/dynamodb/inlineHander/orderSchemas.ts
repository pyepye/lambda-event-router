import { z } from 'zod';

// Schema for new orders (v2 schema with required fields)
export const newOrderSchema = z.object({
  orderId: z.string(),
  customerId: z.string(),
  total: z.number(),
  status: z.enum(['pending', 'confirmed', 'shipped', 'delivered']),
  createdAt: z.string(),
});

// Schema for old orders (v1 schema, might have legacy fields)
export const oldOrderSchema = z.object({
  orderId: z.string(),
  customerId: z.string(),
  total: z.number().optional(), // was optional in v1
  status: z.string(), // was untyped string in v1
});

export const orderKeysSchema = z.object({
  pk: z.string(), // ORDER#<orderId>
  sk: z.string(), // CUSTOMER#<customerId>
});
