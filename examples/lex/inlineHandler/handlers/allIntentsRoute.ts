import { defineRoute } from '@lambda-event-router/lex';

// Matches multiple intents - broad matching across related intents
export const allIntentsRoute = defineRoute({
  filters: {
    intentName: ['OrderPizza', 'OrderDrink', 'CheckOrderStatus'],
  },
}).handle(async ({ intentName, slots, invocationSource }) => {
  console.log(`Handling ${intentName} (${invocationSource}) - slots: ${JSON.stringify(slots)}`);

  return {
    sessionState: {
      dialogAction: {
        type: 'ElicitIntent',
      },
    },
    messages: [
      {
        contentType: 'PlainText',
        content: `What would you like to do with your ${intentName}?`,
      },
    ],
  };
});
