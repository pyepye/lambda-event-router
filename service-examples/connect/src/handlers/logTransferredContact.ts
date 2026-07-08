import { logger } from '@lambda-event-router/base';
import type { ConnectRequest, ConnectResponse } from '@lambda-event-router/connect';

export async function logTransferredContact({ contactData }: ConnectRequest): Promise<ConnectResponse> {
  logger.info({
    message: 'Transferred contact logged',
    contactId: contactData.ContactId,
    previousContactId: contactData.PreviousContactId,
  });

  return { transferred: 'true' };
}
