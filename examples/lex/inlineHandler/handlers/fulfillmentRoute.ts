import { defineRoute } from '@lambda-event-router/lex';

// FulfillmentCodeHook for OrderPizza intent - processes the completed order
export const fulfillmentRoute = defineRoute({
  filters: {
    invocationSources: ['FulfillmentCodeHook'],
    intentNames: ['OrderPizza'],
  },
}).handle(async ({ intentName, slots, inputTranscript }) => {
  console.log(`Fulfilling ${intentName} - transcript: ${inputTranscript}`);
  console.log(`Order slots: ${JSON.stringify(slots)}`);

  return {
    sessionState: {
      dialogAction: {
        type: 'Close',
      },
      intent: {
        name: intentName,
        state: 'Fulfilled',
      },
    },
    messages: [
      {
        contentType: 'PlainText',
        content: 'Your pizza order has been placed!',
      },
    ],
  };
});
