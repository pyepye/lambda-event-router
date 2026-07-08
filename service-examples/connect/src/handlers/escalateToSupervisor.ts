import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/connect';

import { withEscalationContext } from '../middleware/withEscalationContext.js';
import { HIGH_PRIORITY, ORDER_REF_PARAMETER, PRIORITY_PARAMETER } from '../utils/constants.js';

// Registered first, so a high priority contact reaches it whatever step the flow asked for. The
// custom filter is async to show that form.
export const escalateToSupervisor = defineRoute({
  filters: {
    custom: async ({ event }) => event.Details.Parameters[PRIORITY_PARAMETER] === HIGH_PRIORITY,
  },
  middleware: [withEscalationContext],
}).handle(async ({ contactData, parameters }) => {
  const orderRef = parameters[ORDER_REF_PARAMETER] ?? 'unknown';

  logger.info({ message: 'Escalated to a supervisor', contactId: contactData.ContactId, orderRef });

  return { escalationTicket: `ESC-${orderRef}` };
});
