import { logger } from '@lambda-event-router/base';
import type { DynamoDBModifyRouteDefinition } from '@lambda-event-router/dynamodb';

import { ORDERS_STREAM_ARN } from '../config.js';
import { OrderSchema, type TOrder } from '../utils/schemas.js';

// An order whose status moved. The custom filter compares the two images, which is the only way to tell
// a status change from any other edit, and it reads them raw before either schema runs.
// Registered before recordOrderEdit so a status change wins here.
export const handleOrderStatusChange: DynamoDBModifyRouteDefinition<Record<string, unknown>, TOrder, TOrder> = {
  filters: {
    eventSourceArn: ORDERS_STREAM_ARN,
    sortKey: 'SUMMARY',
    custom: ({ newImage, oldImage }) => Boolean(newImage && oldImage && newImage.status !== oldImage.status),
  },
  newImageSchema: OrderSchema,
  oldImageSchema: OrderSchema,
  handler: async (request) => {
    logger.info({
      message: 'Order status changed',
      orderId: request.newImage.orderId,
      from: request.oldImage.status,
      to: request.newImage.status,
    });
  },
};
