import type { WebSocketDisconnectRequest } from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

// A $disconnect arrives after the socket has gone, so nothing can be sent back on it.
export async function closeAlertStream({ connectionId }: WebSocketDisconnectRequest): Promise<void> {
  logger.info({ message: 'Alert stream closed', connectionId });
}
