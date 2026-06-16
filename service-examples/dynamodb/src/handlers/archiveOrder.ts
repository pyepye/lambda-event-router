import { logger } from '@lambda-event-router/base';
import type { DynamoDBRemoveRouteDefinition } from '@lambda-event-router/dynamodb';

import { ORDERS_STREAM_ARN } from '../config.js';
import { OrderSchema, type TOrder } from '../utils/schemas.js';

// A deleted order summary. A REMOVE record carries only the old image, so that is the only schema the
// route can have and the only image the handler can read.
export const archiveOrder: DynamoDBRemoveRouteDefinition<Record<string, unknown>, TOrder> = {
  filters: {
    eventSourceArn: ORDERS_STREAM_ARN,
    sortKey: 'SUMMARY',
  },
  oldImageSchema: OrderSchema,
  handler: async (request) => {
    logger.info({
      message: 'Order archived',
      orderId: request.oldImage.orderId,
      status: request.oldImage.status,
      total: request.oldImage.total,
    });
  },
};
