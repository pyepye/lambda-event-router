import { logger } from '@latcher/base';
import type { ConnectRequest, ConnectResponse } from '@latcher/connect';

export async function logTransferredContact({ contactData }: ConnectRequest): Promise<ConnectResponse> {
  logger.info({
    message: 'Transferred contact logged',
    contactId: contactData.ContactId,
    previousContactId: contactData.PreviousContactId,
  });

  return { transferred: 'true' };
}
