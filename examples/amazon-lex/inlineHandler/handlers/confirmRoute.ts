import { defineRoute } from '@lambda-event-router/amazon-lex';

import { BOT_ID } from '../constants.js';

// DialogCodeHook for OrderDrink - confirms the order before fulfillment
export const confirmRoute = defineRoute({
  filters: {
    invocationSources: ['DialogCodeHook'],
    intentNames: ['OrderDrink'],
    botIds: [BOT_ID],
  },
}).handle(async ({ intentName, slots }) => {
  console.log(`Confirming ${intentName} - slots: ${JSON.stringify(slots)}`);

  return {
    sessionState: {
      dialogAction: {
        type: 'ConfirmIntent',
      },
      intent: {
        name: intentName,
        state: 'InProgress',
      },
    },
    messages: [
      {
        contentType: 'PlainText',
        content: 'Just to confirm, you want a large iced coffee?',
      },
    ],
  };
});
