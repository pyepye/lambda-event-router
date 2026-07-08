import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/connect';

import { CONNECT_INSTANCE_ARN } from '../config.js';
import { atStep } from '../utils/atStep.js';
import { DELIVERY_SLOT, DELIVERY_SLOT_STEP } from '../utils/constants.js';

// instanceArn as an exact string, so only the deployed instance reaches this route.
export const checkDeliverySlot = defineRoute({
  filters: {
    instanceArn: CONNECT_INSTANCE_ARN,
    custom: atStep(DELIVERY_SLOT_STEP),
  },
}).handle(async ({ contactData }) => {
  logger.info({ message: 'Delivery slot offered', contactId: contactData.ContactId, slot: DELIVERY_SLOT });

  return { deliverySlot: DELIVERY_SLOT };
});
