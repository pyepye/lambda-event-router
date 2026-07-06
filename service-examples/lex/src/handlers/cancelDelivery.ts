import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/lex';

import { withCancellationAudit } from '../middleware/withCancellationAudit.js';
import { TRACKING_NUMBER_SLOT } from '../utils/constants.js';

// The wildcard covers CancelDelivery and any later Cancel* intent, so a new one needs no new route.
export const cancelDelivery = defineRoute({
  filters: {
    intentName: 'Cancel*',
    invocationSource: 'FulfillmentCodeHook',
  },
  middleware: [withCancellationAudit],
}).handle(async ({ intentName, slots }) => {
  const trackingNumber = (slots[TRACKING_NUMBER_SLOT]?.value.interpretedValue ?? '').toUpperCase();

  logger.info({ message: 'Delivery cancelled', intentName, trackingNumber });

  return {
    sessionState: {
      dialogAction: { type: 'Close' },
      intent: { name: intentName, state: 'Fulfilled' },
    },
    messages: [{ contentType: 'PlainText', content: `Delivery ${trackingNumber} is cancelled.` }],
  };
});
