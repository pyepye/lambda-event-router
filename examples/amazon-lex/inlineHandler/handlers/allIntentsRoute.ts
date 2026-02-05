import { defineRoute } from '@lambda-event-router/amazon-lex';

// Matches multiple intents - broad matching across related intents
export const allIntentsRoute = defineRoute({
  filters: {
    intentNames: ['OrderPizza', 'OrderDrink', 'CheckOrderStatus'],
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
