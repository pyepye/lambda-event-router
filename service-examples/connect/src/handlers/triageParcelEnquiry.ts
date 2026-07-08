import { logger } from '@lambda-event-router/base';
import type { ConnectRequest, ConnectResponse } from '@lambda-event-router/connect';

// A task contact. Its channel is TASK, which only ConnectChannel carries: the aws-lambda union stops
// at VOICE, CHAT and EMAIL.
export async function triageParcelEnquiry({ contactData }: ConnectRequest): Promise<ConnectResponse> {
  logger.info({ message: 'Parcel enquiry triaged', contactId: contactData.ContactId, channel: contactData.Channel });

  return { triageStatus: 'triaged' };
}
