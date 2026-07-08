import { logger } from '@lambda-event-router/base';
import type { ConnectRequest, ConnectResponse } from '@lambda-event-router/connect';

export async function confirmCallbackBooked({ contactData }: ConnectRequest): Promise<ConnectResponse> {
  logger.info({ message: 'Callback confirmed', contactId: contactData.ContactId });

  return { callbackConfirmed: 'true' };
}
