import { logger } from '@lambda-event-router/base';
import type { ActiveMQBytesMessageRequest } from '@lambda-event-router/mq';

// A shipping label is a PDF, so it travels as a bytes message and the body is the raw Buffer decoded
// from base64. There is no JSON to check, which is why a bytes route takes no bodySchema.
export async function archiveOrderLabel(request: ActiveMQBytesMessageRequest): Promise<void> {
  logger.info({
    message: 'Order label archived',
    orderId: request.message.properties.labelFor,
    bytes: request.body.length,
    header: request.body.subarray(0, 4).toString('latin1'),
  });
}
