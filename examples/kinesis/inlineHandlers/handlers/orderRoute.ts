import { defineRoute } from '@lambda-event-router/kinesis';
import { z } from 'zod';

import { ORDER_STREAM_ARN } from '../constants.js';

const OrderDataSchema = z.object({
  orderId: z.string(),
  customerId: z.string(),
  total: z.number(),
  status: z.enum(['CREATED', 'CONFIRMED', 'SHIPPED', 'DELIVERED']),
});

export const orderRoute = defineRoute({
  filters: {
    eventSourceArn: ORDER_STREAM_ARN,
  },
  dataSchema: OrderDataSchema,
}).handle(async ({ data, partitionKey, sequenceNumber, context }) => {
  const { orderId, customerId, total, status } = data;

  const isPending = status === 'CREATED' || status === 'CONFIRMED';
  const action = isPending ? 'NOTIFY_WAREHOUSE' : 'NOTIFY_CUSTOMER';

  console.log('Processing order', {
    orderId,
    customerId,
    total,
    action,
    partitionKey,
    sequenceNumber,
    correlationId: context.awsRequestId,
  });
});
