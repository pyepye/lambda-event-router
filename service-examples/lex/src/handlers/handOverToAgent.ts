import { defineRoute } from '@lambda-event-router/lex';

import { SPEAK_TO_AGENT_INTENT } from '../utils/constants.js';

// The only route that fails inside the handler rather than by never matching. The middleware chain
// has already run by the time it throws, so this turn has a logTurn line and an unmatched turn has none.
export const handOverToAgent = defineRoute({
  filters: {
    intentName: SPEAK_TO_AGENT_INTENT,
    inputMode: 'Text',
  },
}).handle(async ({ inputTranscript }) => {
  throw new Error(`No agent is free to take "${inputTranscript}"`);
});
