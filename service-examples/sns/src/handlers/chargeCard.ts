import { defineRoute } from '@lambda-event-router/sns';

import { ORDERS_TOPIC_ARN } from '../config.js';
import { PaymentSchema } from '../utils/schemas.js';

// Card payments always throw, which is the only route here that fails inside the handler rather than
// on its schema. The distinction shows in the logs: the middleware chain has already run by the time
// the handler throws, so this record has a `Handling SNS record` line. A record that fails validation
// has none.
export const chargeCard = defineRoute({
  filters: {
    topicArn: ORDERS_TOPIC_ARN,
    messageAttributes: { eventType: 'PaymentRequested' },
  },
  bodySchema: PaymentSchema,
}).handle(async (request) => {
  throw new Error(`Payment gateway declined order ${request.body.orderId}`);
});
