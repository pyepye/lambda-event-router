import { createAmazonLexRouter } from '@lambda-event-router/amazon-lex';
import { EventRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { fulfillPizzaOrder, handleOrder, validatePizzaOrder } from './handlers.js';

const amazonLexRouter = createAmazonLexRouter();

const BOT_ID = 'ABCDEF1234';

amazonLexRouter.route({
  filters: {
    intentNames: ['OrderPizza', 'OrderDrink'],
    botIds: [BOT_ID],
  },
  handler: handleOrder,
});

amazonLexRouter.dialogCodeHook({
  filters: {
    intentNames: ['OrderPizza'],
    botIds: [BOT_ID],
    // invocationSources: ['DialogCodeHook'], // Not valid filter for .dialogCodeHook()
  },
  handler: validatePizzaOrder,
});

amazonLexRouter.fulfillmentCodeHook({
  filters: {
    intentNames: ['OrderPizza'],
    // invocationSources: ['FulfillmentCodeHook'], // Not valid filter for .fulfillmentCodeHook()
  },
  handler: fulfillPizzaOrder,
});

const eventRouter = new EventRouter({
  routers: [amazonLexRouter],
});

export const handler: Handler = eventRouter.handler();
