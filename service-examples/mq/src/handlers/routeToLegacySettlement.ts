import { logger } from '@lambda-event-router/base';
import { defineRabbitMQRoute } from '@lambda-event-router/mq';

import { LEGACY_PAYMENT_BROKER_ARN } from '../config.js';
import { PAYMENT_QUEUES } from '../utils/brokers.js';
import { PaymentSchema } from '../utils/schemas.js';

// Settlement still runs on a second broker while the payments team migrates off it. Nothing maps that
// broker, so this route is skipped on the ARN and the message carries on to the next route.
export const routeToLegacySettlement = defineRabbitMQRoute({
  filters: {
    eventSourceArn: LEGACY_PAYMENT_BROKER_ARN,
    queue: PAYMENT_QUEUES.events,
  },
  bodySchema: PaymentSchema,
}).handle(async (request) => {
  logger.info({ message: 'Payment sent to legacy settlement', paymentId: request.body.paymentId });
});
