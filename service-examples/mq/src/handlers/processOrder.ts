import { logger } from '@lambda-event-router/base';
import type { ActiveMQTextMessageRequest } from '@lambda-event-router/mq';

import type { TOrder } from '../utils/schemas.js';

// The normal run. Registered with textMessage(), which sets the messageType filter, so the request
// is a text message and the body is the parsed JSON rather than a Buffer.
export async function processOrder(request: ActiveMQTextMessageRequest<TOrder>): Promise<void> {
  logger.info({
    message: 'Order processed',
    orderId: request.body.orderId,
    customer: request.body.customer,
    total: request.body.total,
    destination: request.destination,
  });
}
