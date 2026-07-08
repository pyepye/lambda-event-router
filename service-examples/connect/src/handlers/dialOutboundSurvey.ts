import { logger } from '@lambda-event-router/base';
import type { ConnectRequest, ConnectResponse } from '@lambda-event-router/connect';

export async function dialOutboundSurvey({ contactData }: ConnectRequest): Promise<ConnectResponse> {
  logger.info({ message: 'Outbound survey dialled', contactId: contactData.ContactId });

  return { surveyId: 'delivery-satisfaction' };
}
