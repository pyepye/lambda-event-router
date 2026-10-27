import { logger } from '@latcher/base';
import type { LexFulfillmentCodeHookRequest, LexResponse } from '@latcher/lex';

import { ACCOUNT_TIER_ATTRIBUTE } from '../utils/constants.js';

export async function escalateToSupervisor({
  intentName,
  sessionAttributes,
}: LexFulfillmentCodeHookRequest): Promise<LexResponse> {
  logger.info({
    message: 'Escalated to a supervisor',
    intentName,
    accountTier: sessionAttributes[ACCOUNT_TIER_ATTRIBUTE],
  });

  return {
    sessionState: {
      sessionAttributes,
      dialogAction: { type: 'Close' },
      intent: { name: intentName, state: 'Fulfilled' },
    },
    messages: [{ contentType: 'PlainText', content: 'A supervisor will call you back within the hour.' }],
  };
}
