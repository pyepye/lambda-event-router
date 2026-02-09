import { defineRoute } from '@lambda-event-router/lex';

import { BOT_ID } from '../constants.js';

// DialogCodeHook for OrderPizza intent - validates slots before fulfillment
export const dialogHookRoute = defineRoute({
  filters: {
    invocationSources: ['DialogCodeHook'],
    intentNames: ['OrderPizza'],
    botIds: [BOT_ID],
  },
}).handle(async ({ intentName, slots, sessionAttributes }) => {
  console.log(`Dialog hook for ${intentName} - slots: ${JSON.stringify(slots)}`);
  console.log(`Session attributes: ${JSON.stringify(sessionAttributes)}`);

  return {
    sessionState: {
      dialogAction: {
        type: 'Delegate',
      },
      intent: {
        name: intentName,
        state: 'InProgress',
      },
    },
  };
});
