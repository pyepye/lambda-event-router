import { logger } from '@lambda-event-router/base';
import { defineRabbitMQRoute } from '@lambda-event-router/mq';

import { PAYMENT_BROKER_ARN } from '../config.js';
import { withPaymentContext } from '../middleware/withPaymentContext.js';
import { PAYMENT_QUEUES } from '../utils/brokers.js';
import { PaymentSchema } from '../utils/schemas.js';

// A high value payment settles the same day. The custom filter reads the AMQP priority, which arrives
// as null when the publisher does not set one, and the route sits ahead of capturePayment so it wins
// on the same queue.
export const settleHighValuePayment = defineRabbitMQRoute({
  filters: {
    eventSourceArn: PAYMENT_BROKER_ARN,
    queue: PAYMENT_QUEUES.events,
    custom: ({ record }) => (record.basicProperties.priority ?? 0) >= 5,
  },
  bodySchema: PaymentSchema,
  middleware: [withPaymentContext],
}).handle(async (request) => {
  logger.info({
    message: 'High value payment settled',
    paymentId: request.body.paymentId,
    amount: request.body.amount, // converted by the schema
    method: request.body.method,
  });
});
