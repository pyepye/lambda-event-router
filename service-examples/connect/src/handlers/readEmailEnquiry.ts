import { logger } from '@lambda-event-router/base';
import type { ConnectRequest, ConnectResponse } from '@lambda-event-router/connect';

export async function readEmailEnquiry({ contactData }: ConnectRequest): Promise<ConnectResponse> {
  logger.info({ message: 'Email enquiry read', contactId: contactData.ContactId });

  return { enquiryType: 'delivery' };
}
