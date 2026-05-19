import type { Handler } from 'aws-lambda';

import { LambdaRouter } from '@lambda-event-router/base';
import { createLexRouter, type LexFilterInput } from '@lambda-event-router/lex';

import { fulfillPizzaOrder, handleOrder, validatePizzaOrder } from './handlers.js';

const lexRouter = createLexRouter();

const BOT_ID = 'ABCDEF1234';

lexRouter.route({
  filters: {
    intentName: ['OrderPizza', 'OrderDrink'],
    botId: BOT_ID,
  },
  handler: handleOrder,
});

lexRouter.dialogCodeHook({
  filters: {
    intentName: 'OrderPizza',
    botId: BOT_ID,
    // invocationSource: 'DialogCodeHook', // Not valid filter for .dialogCodeHook()
  },
  handler: validatePizzaOrder,
});

lexRouter.fulfillmentCodeHook({
  filters: {
    intentName: 'OrderPizza',
    // invocationSource: 'FulfillmentCodeHook', // Not valid filter for .fulfillmentCodeHook()
  },
  handler: fulfillPizzaOrder,
});

function isSpeechInput({ inputMode, botId }: LexFilterInput): boolean {
  return inputMode === 'Speech' && botId === BOT_ID;
}

lexRouter.fulfillmentCodeHook({
  filters: {
    intentName: 'OrderPizza',
    custom: isSpeechInput,
  },
  handler: fulfillPizzaOrder,
});

const lambdaRouter = new LambdaRouter({
  routers: [lexRouter],
});

export const handler: Handler = lambdaRouter.handler();
