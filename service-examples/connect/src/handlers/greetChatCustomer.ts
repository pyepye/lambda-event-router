import { logger } from '@latcher/base';
import type { ConnectRequest, ConnectResponse } from '@latcher/connect';

import { ORDER_REF_ATTRIBUTE } from '../utils/constants.js';

// Reads the contact attribute the trigger set when it started the chat.
export async function greetChatCustomer({ contactData }: ConnectRequest): Promise<ConnectResponse> {
  const orderRef = contactData.Attributes[ORDER_REF_ATTRIBUTE] ?? 'unknown';

  logger.info({ message: 'Chat customer greeted', contactId: contactData.ContactId, orderRef });

  return { greetingStatus: 'greeted' };
}
