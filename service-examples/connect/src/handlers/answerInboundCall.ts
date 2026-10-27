import { logger } from '@latcher/base';
import type { ConnectRequest, ConnectResponse } from '@latcher/connect';

export async function answerInboundCall({ contactData }: ConnectRequest): Promise<ConnectResponse> {
  logger.info({
    message: 'Inbound call answered',
    contactId: contactData.ContactId,
    caller: contactData.CustomerEndpoint?.Address ?? null,
  });

  return { greeting: 'parcel-line-welcome' };
}
