import { defineRoute } from '@lambda-event-router/dynamodb';

import { STREAM_ARN } from '../constants.js';
import { oldOrderSchema } from '../orderSchemas.js';

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
