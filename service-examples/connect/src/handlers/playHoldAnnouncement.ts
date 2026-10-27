import { logger } from '@latcher/base';
import type { ConnectRequest, ConnectResponse } from '@latcher/connect';

// The last voice route, so it takes every voice contact the inbound route above it leaves.
export async function playHoldAnnouncement({ contactData }: ConnectRequest): Promise<ConnectResponse> {
  logger.info({
    message: 'Hold announcement played',
    contactId: contactData.ContactId,
    initiationMethod: contactData.InitiationMethod,
  });

  return { announcement: 'agents-busy' };
}
