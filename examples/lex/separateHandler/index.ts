import { LambdaRouter } from '@lambda-event-router/base';
import { createLexRouter, type LexFilterInput } from '@lambda-event-router/lex';
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

function isSpeechInput({ inputMode, botId }: LexFilterInput): boolean {
  return inputMode === 'Speech' && botId === BOT_ID;
}

lexRouter.fulfillmentCodeHook({
  filters: {
    intentNames: ['OrderPizza'],
    customFilter: isSpeechInput,
  },
  handler: fulfillPizzaOrder,
});

const lambdaRouter = new LambdaRouter({
  routers: [lexRouter],
});

export const handler: Handler = lambdaRouter.handler();
