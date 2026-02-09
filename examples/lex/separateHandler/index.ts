import { EventRouter } from '@lambda-event-router/base';
import { createLexRouter } from '@lambda-event-router/lex';
import type { Handler } from 'aws-lambda';

import { fulfillPizzaOrder, handleOrder, validatePizzaOrder } from './handlers.js';

const lexRouter = createLexRouter();

const BOT_ID = 'ABCDEF1234';

lexRouter.route({
  filters: {
    intentNames: ['OrderPizza', 'OrderDrink'],
    botIds: [BOT_ID],
  },
  handler: handleOrder,
});

lexRouter.dialogCodeHook({
  filters: {
    intentNames: ['OrderPizza'],
    botIds: [BOT_ID],
    // invocationSources: ['DialogCodeHook'], // Not valid filter for .dialogCodeHook()
  },
  handler: validatePizzaOrder,
});

lexRouter.fulfillmentCodeHook({
  filters: {
    intentNames: ['OrderPizza'],
    // invocationSources: ['FulfillmentCodeHook'], // Not valid filter for .fulfillmentCodeHook()
  },
  handler: fulfillPizzaOrder,
});

const eventRouter = new EventRouter({
  routers: [lexRouter],
});

export const handler: Handler = eventRouter.handler();
