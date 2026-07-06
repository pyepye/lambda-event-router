import { logger } from '@lambda-event-router/base';
import type { LexDialogCodeHookRequest, LexResponse } from '@lambda-event-router/lex';

import { TRACKING_NUMBER_PATTERN, TRACKING_NUMBER_SLOT } from '../utils/constants.js';

// The dialog hook for both tracking intents. It delegates once the slot holds a tracking number in
// the right shape, and re-elicits the slot until it does.
export async function checkTrackingNumber({ intentName, slots }: LexDialogCodeHookRequest): Promise<LexResponse> {
  const slot = slots[TRACKING_NUMBER_SLOT];
  const trackingNumber = (slot?.value.interpretedValue ?? slot?.value.originalValue ?? '').toUpperCase();

  if (TRACKING_NUMBER_PATTERN.test(trackingNumber)) {
    logger.info({ message: 'Tracking number accepted', intentName, trackingNumber });
    return {
      sessionState: {
        dialogAction: { type: 'Delegate' },
        intent: { name: intentName, state: 'InProgress', slots },
      },
    };
  }

  logger.info({ message: 'Tracking number rejected', intentName, trackingNumber });
  return {
    sessionState: {
      dialogAction: { type: 'ElicitSlot', slotToElicit: TRACKING_NUMBER_SLOT },
      intent: { name: intentName, state: 'InProgress', slots: { ...slots, [TRACKING_NUMBER_SLOT]: null } },
    },
    messages: [
      {
        contentType: 'PlainText',
        content: trackingNumber
          ? 'That tracking number does not look right. It is two letters and six digits.'
          : 'What is the tracking number?',
      },
    ],
  };
}
