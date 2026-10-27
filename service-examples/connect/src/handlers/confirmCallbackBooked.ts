import { logger } from '@latcher/base';
import type { ConnectRequest, ConnectResponse } from '@latcher/connect';

export async function confirmCallbackBooked({ contactData }: ConnectRequest): Promise<ConnectResponse> {
  logger.info({ message: 'Callback confirmed', contactId: contactData.ContactId });

  return { callbackConfirmed: 'true' };
}
