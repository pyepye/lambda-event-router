import { defineRoute, type LexFilterInput } from '@lambda-event-router/lex';

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

// Match fulfillment for premium-tier users - filters on session attributes, not inputMode/botId
export const premiumFulfillmentRoute = defineRoute({
  filters: {
    invocationSources: ['FulfillmentCodeHook'],
    intentNames: ['OrderPizza'],
    customFilter: ({ event }: LexFilterInput) => {
      const tier = event.sessionState?.sessionAttributes?.tier;
      return tier === 'premium';
    },
  },
}).handle(async ({ intentName, slots, inputTranscript }) => {
  console.log(`Premium fulfillment for ${intentName} - transcript: ${inputTranscript}`);
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
        content: 'Your premium pizza order has been prioritized!',
      },
    ],
  };
});
