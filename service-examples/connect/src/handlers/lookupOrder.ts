import { logger } from '@latcher/base';
import type { ConnectRequest, ConnectResponse } from '@latcher/connect';

import { ORDER_REF_PARAMETER } from '../utils/constants.js';

export async function lookupOrder({ contactData, parameters }: ConnectRequest): Promise<ConnectResponse> {
  const orderRef = parameters[ORDER_REF_PARAMETER] ?? 'unknown';

  logger.info({ message: 'Order located', contactId: contactData.ContactId, orderRef });

  return { orderStatus: 'dispatched', orderRef };
}
