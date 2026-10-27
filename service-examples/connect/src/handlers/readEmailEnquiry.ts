import { logger } from '@latcher/base';
import type { ConnectRequest, ConnectResponse } from '@latcher/connect';

export async function readEmailEnquiry({ contactData }: ConnectRequest): Promise<ConnectResponse> {
  logger.info({ message: 'Email enquiry read', contactId: contactData.ContactId });

  return { enquiryType: 'delivery' };
}
