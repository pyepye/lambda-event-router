import { logger } from '@latcher/base';
import type { LexFulfillmentCodeHookRequest, LexResponse } from '@latcher/lex';

import { TRACKING_NUMBER_SLOT } from '../utils/constants.js';
import { locateParcel } from '../utils/parcels.js';

export async function reportParcelLocation({ intentName, slots }: LexFulfillmentCodeHookRequest): Promise<LexResponse> {
  const trackingNumber = (slots[TRACKING_NUMBER_SLOT]?.value.interpretedValue ?? '').toUpperCase();
  const location = locateParcel(trackingNumber);

  logger.info({ message: 'Parcel located', trackingNumber, location });

  return {
    sessionState: {
      dialogAction: { type: 'Close' },
      intent: { name: intentName, state: 'Fulfilled' },
    },
    messages: [{ contentType: 'PlainText', content: `Parcel ${trackingNumber} is ${location}.` }],
  };
}
