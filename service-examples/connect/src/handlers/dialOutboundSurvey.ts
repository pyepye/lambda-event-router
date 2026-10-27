import { logger } from '@latcher/base';
import type { ConnectRequest, ConnectResponse } from '@latcher/connect';

export async function dialOutboundSurvey({ contactData }: ConnectRequest): Promise<ConnectResponse> {
  logger.info({ message: 'Outbound survey dialled', contactId: contactData.ContactId });

  return { surveyId: 'delivery-satisfaction' };
}
