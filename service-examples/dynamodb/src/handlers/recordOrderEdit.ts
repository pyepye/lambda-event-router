import { logger } from '@latcher/base';
import type { DynamoDBModifyRouteDefinition } from '@latcher/dynamodb';

import { ORDERS_STREAM_ARN } from '../config.js';
import { OrderSchema, type TOrder } from '../utils/schemas.js';

// Every other edit to an order summary. No custom filter, so it takes whatever handleOrderStatusChange
// turned down.
// It carries no oldImageSchema, so `request.oldImage` stays the unmarshalled record.
export const recordOrderEdit: DynamoDBModifyRouteDefinition<Record<string, unknown>, TOrder> = {
  filters: {
    eventSourceArn: ORDERS_STREAM_ARN,
    sortKey: 'SUMMARY',
  },
  newImageSchema: OrderSchema,
  handler: async (request) => {
    logger.info({
      message: 'Order edited',
      orderId: request.newImage.orderId,
      status: request.newImage.status,
      note: request.newImage.note,
    });
  },
};
