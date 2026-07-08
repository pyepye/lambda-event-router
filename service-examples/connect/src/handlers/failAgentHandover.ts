import { defineRoute } from '@lambda-event-router/connect';

import { atStep } from '../utils/atStep.js';
import { AGENT_HANDOVER_STEP } from '../utils/constants.js';

// The only route that fails inside the handler rather than by never matching. The middleware chain
// has already run by the time it throws, so this contact has a logContact line and an unmatched
// contact has none.
export const failAgentHandover = defineRoute({
  filters: { custom: atStep(AGENT_HANDOVER_STEP) },
}).handle(async ({ contactData }) => {
  throw new Error(`No agent is free to take contact ${contactData.ContactId}`);
});
