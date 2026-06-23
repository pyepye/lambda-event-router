import { logger } from '@lambda-event-router/base';
import type { RabbitMQRequest } from '@lambda-event-router/mq';

// An operator note travels as plain text. The route declares no bodySchema, so the body is whatever
// the JSON parse returned, which for text that is not JSON is the text itself.
export async function recordPaymentNote(request: RabbitMQRequest): Promise<void> {
  logger.info({
    message: 'Payment note recorded',
    note: request.body,
    contentType: request.record.basicProperties.contentType,
  });
}
