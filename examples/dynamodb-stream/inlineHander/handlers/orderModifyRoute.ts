import { defineRoute } from '@lambda-event-router/dynamodb-stream';

import { STREAM_ARN } from '../constants.js';
import { newOrderSchema, oldOrderSchema, orderKeysSchema } from '../orderSchemas.js';

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

export const orderRemoveRoute2 = defineRoute({
  filters: {
    eventNames: ['REMOVE'],
    streamViewTypes: ['NEW_AND_OLD_IMAGES'],
    eventSourceArns: [STREAM_ARN],
  },
}).handle(async ({ keys, oldImage }) => {
  // For REMOVE events: newImage is undefined, oldImage is guaranteed
  console.log(`Order ${keys.pk} for ${keys.sk} removed with status: ${oldImage.status}`);
});

export const orderModifyRouteNoSchema = defineRoute({
  filters: {
    eventNames: ['MODIFY'],
    eventSourceArns: [STREAM_ARN],
  },
}).handle(async ({ keys, newImage, oldImage }) => {
  // keys is typed as z.infer<typeof orderKeysSchema>
  // newImage is typed as z.infer<typeof newOrderSchema>
  // oldImage is typed as z.infer<typeof oldOrderSchema>
  console.log(`Order ${keys.pk} for ${keys.sk} updated: ${oldImage.status} -> ${newImage.status}`);
  console.log(`Total changed from ${oldImage.total ?? 'unknown'} to ${newImage.total}`);
});
