import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/connect';

import { atStep } from '../utils/atStep.js';
import { CALLBACK_OFFER_STEP } from '../utils/constants.js';

// instanceArn as a pattern, so any Connect instance reaches this route.
export const offerCallback = defineRoute({
  filters: {
    instanceArn: /:instance\//,
    initiationMethod: ['API', 'INBOUND'],
    custom: atStep(CALLBACK_OFFER_STEP),
  },
}).handle(async ({ contactData }) => {
  logger.info({ message: 'Callback offered', contactId: contactData.ContactId });

  return { callbackOffered: 'true' };
});
