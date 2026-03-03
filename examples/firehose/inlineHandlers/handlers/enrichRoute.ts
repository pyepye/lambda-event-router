import { defineRoute, Ok } from '@lambda-event-router/firehose';
import { z } from 'zod';

import { DELIVERY_STREAM_ARN } from '../constants.js';

const OrderDataSchema = z.object({
  orderId: z.string(),
  customerId: z.string(),
  total: z.number(),
});

export const enrichRoute = defineRoute({
  filters: {
    deliveryStreamArns: [DELIVERY_STREAM_ARN],
  },
  dataSchema: OrderDataSchema,
}).handle(async ({ data, recordId, context, approximateArrivalTimestamp }) => {
  const ingestionDelayMs = Date.now() - approximateArrivalTimestamp;

  const enrichedData = {
    ...data,
    processedAt: new Date().toISOString(),
    region: 'us-east-1',
    traceId: context.awsRequestId,
    recordId,
    ingestionDelayMs,
  };

  // Ok() auto-stringifies objects
  return Ok(enrichedData);
});
