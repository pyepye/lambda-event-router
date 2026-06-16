import { logger } from '@lambda-event-router/base';
import type { DynamoDBInsertRouteDefinition } from '@lambda-event-router/dynamodb';

import { ORDERS_STREAM_ARN } from '../config.js';
import { withOrderContext } from '../middleware/withOrderContext.js';
import { OrderSchema, type TOrder } from '../utils/schemas.js';

// A new order, picked out by its key pair: an ORDER# partition with the SUMMARY sort key.
// Registered with `insert`, so the router adds the INSERT event name to the filters itself.
// The logged types show what unmarshalling produced: `total` is a number and `tags` is a Set, so
// OrderSchema can check them as such rather than coercing strings.
export const processOrder: DynamoDBInsertRouteDefinition<Record<string, unknown>, TOrder> = {
  filters: {
    eventSourceArn: ORDERS_STREAM_ARN,
    partitionKey: 'ORDER#*',
    sortKey: 'SUMMARY',
  },
  newImageSchema: OrderSchema,
  middleware: [withOrderContext],
  handler: async (request) => {
    const { customer, total, tags } = request.newImage;

    logger.info({
      message: 'Order accepted for fulfilment',
      customer,
      total,
      tags: [...tags],
      unmarshalledTypes: { total: typeof total, tags: tags instanceof Set },
    });
  },
};
