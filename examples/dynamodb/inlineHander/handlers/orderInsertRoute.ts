import { defineRoute } from '@lambda-event-router/dynamodb';

import { STREAM_ARN } from '../constants.js';
import { newOrderSchema } from '../orderSchemas.js';

// INSERT with only newImageSchema - oldImage is undefined for INSERT
export const orderInsertRoute = defineRoute({
  filters: {
    eventName: 'INSERT',
    eventSourceArn: STREAM_ARN,
  },
  newImageSchema: newOrderSchema,
}).handle(async ({ newImage }) => {
  // newImage is typed as z.infer<typeof newOrderSchema>
  console.log(`New order created: ${newImage.orderId} for customer ${newImage.customerId}`);
});
