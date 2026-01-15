import { defineRoute } from '@lambda-event-router/dynamodb-stream';
import { z } from 'zod';

const STREAM_ARN = 'arn:aws:dynamodb-stream:region:account-id:some-stream';

// INSERT only - newImage is guaranteed, oldImage is undefined
export const insertRoute = defineRoute({
  filters: {
    eventNames: ['INSERT'],
    eventSourceArns: [STREAM_ARN],
  },
}).handle(async ({ newImage, keys }) => {
  const { pk, sk } = keys;
  console.log(`newImage ${newImage} - pk ${pk} - sk ${sk}`);
});

// All events - newImage/oldImage depend on eventName
export const allEventsRoute = defineRoute({
  filters: {
    eventNames: ['INSERT', 'MODIFY', 'REMOVE'],
    eventSourceArns: [STREAM_ARN],
  },
}).handle(async ({ newImage, oldImage, keys }) => {
  const { pk, sk } = keys;
  console.log(`newImage ${newImage} - oldImage ${oldImage} - pk ${pk} - sk ${sk}`);
});

export const noEventNameRoute = defineRoute({
  filters: { eventSourceArns: [''] },
}).handle(async ({ eventName }) => {
  console.log(`eventName ${eventName}`);
});

// Schema for new orders (v2 schema with required fields)
const newOrderSchema = z.object({
  orderId: z.string(),
  customerId: z.string(),
  total: z.number(),
  status: z.enum(['pending', 'confirmed', 'shipped', 'delivered']),
  createdAt: z.string(),
});

// Schema for old orders (v1 schema, might have legacy fields)
const oldOrderSchema = z.object({
  orderId: z.string(),
  customerId: z.string(),
  total: z.number().optional(), // was optional in v1
  status: z.string(), // was untyped string in v1
});

const orderKeysSchema = z.object({
  pk: z.string(), // ORDER#<orderId>
  sk: z.string(), // CUSTOMER#<customerId>
});

// MODIFY with separate schemas - keys, newImage and oldImage can have different shapes
export const orderModifyRoute = defineRoute({
  filters: {
    eventNames: ['MODIFY'],
    eventSourceArns: [STREAM_ARN],
  },
  keysSchema: orderKeysSchema,
  newImageSchema: newOrderSchema,
  oldImageSchema: oldOrderSchema,
}).handle(async ({ keys, newImage, oldImage }) => {
  // keys is typed as z.infer<typeof orderKeysSchema>
  // newImage is typed as z.infer<typeof newOrderSchema>
  // oldImage is typed as z.infer<typeof oldOrderSchema>
  console.log(`Order ${keys.pk} for ${keys.sk} updated: ${oldImage.status} -> ${newImage.status}`);
  console.log(`Total changed from ${oldImage.total ?? 'unknown'} to ${newImage.total}`);
});

// INSERT with only newImageSchema - oldImage is undefined for INSERT
export const orderInsertRoute = defineRoute({
  filters: {
    eventNames: ['INSERT'],
    eventSourceArns: [STREAM_ARN],
  },
  newImageSchema: newOrderSchema,
}).handle(async ({ newImage }) => {
  // newImage is typed as z.infer<typeof newOrderSchema>
  console.log(`New order created: ${newImage.orderId} for customer ${newImage.customerId}`);
});

// REMOVE with only oldImageSchema - newImage is undefined for REMOVE
export const orderRemoveRoute = defineRoute({
  filters: {
    eventNames: ['REMOVE'],
    eventSourceArns: [STREAM_ARN],
  },
  oldImageSchema: oldOrderSchema,
}).handle(async ({ oldImage }) => {
  // oldImage is typed as z.infer<typeof oldOrderSchema>
  console.log(`Order deleted: ${oldImage.orderId}`);
});
