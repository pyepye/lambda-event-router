import { z } from 'zod';

export const orderDocumentKeySchema = z.object({
  _id: z.string(),
});

export const orderFullDocumentSchema = z.object({
  _id: z.string(),
  customerId: z.string(),
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number(),
      price: z.number(),
    }),
  ),
  total: z.number(),
  status: z.enum(['pending', 'confirmed', 'shipped', 'delivered']),
  createdAt: z.string(),
});

// fullDocumentBeforeChange is only present when the change stream is
// configured with fullDocumentBeforeChange: 'whenAvailable' | 'required'
export const orderFullDocumentBeforeChangeSchema = z.object({
  _id: z.string(),
  customerId: z.string(),
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number(),
      price: z.number(),
    }),
  ),
  total: z.number(),
  status: z.string(),
  createdAt: z.string(),
});
