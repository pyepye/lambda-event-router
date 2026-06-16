import { logger } from '@lambda-event-router/base';
import type { DynamoDBInsertRouteDefinition } from '@lambda-event-router/dynamodb';

import { DECLINED_CARD_TOKEN, ORDERS_STREAM_ARN } from '../config.js';
import { PaymentKeysSchema, PaymentSchema, type TPayment, type TPaymentKeys } from '../utils/schemas.js';

// A payment written against an order, picked out by the sort key alone.
// PaymentKeysSchema splits the key pair into the two ids, so the handler reads them off `request.keys`
// rather than parsing the raw strings.
// A declined card is the one route here that fails inside the handler rather than on a schema. The
// difference shows in the log: the middleware chain has already run, so this record has a
// `Handling DynamoDB record` line. A record that fails validation has none.
export const chargeCard: DynamoDBInsertRouteDefinition<TPaymentKeys, TPayment> = {
  filters: {
    eventSourceArn: ORDERS_STREAM_ARN,
    sortKey: 'PAYMENT#*',
  },
  keysSchema: PaymentKeysSchema,
  newImageSchema: PaymentSchema,
  handler: async (request) => {
    const { orderId, paymentRef } = request.keys;

    if (request.newImage.cardToken === DECLINED_CARD_TOKEN) {
      throw new Error(`Payment gateway declined ${paymentRef} for order ${orderId}`);
    }

    logger.info({
      message: 'Card charged',
      orderId,
      paymentRef,
      amount: request.newImage.amount,
    });
  },
};
