import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/lex';

import { BOT_ID } from '../config.js';
import { BOOK_REDELIVERY_INTENT } from '../utils/constants.js';

export const bookRedelivery = defineRoute({
  filters: {
    intentName: BOOK_REDELIVERY_INTENT,
    botId: BOT_ID,
    invocationSource: ['DialogCodeHook', 'FulfillmentCodeHook'],
    inputMode: ['Text', 'Speech'],
  },
}).handle(async ({ intentName, bot }) => {
  logger.info({ message: 'Redelivery booked', intentName, botId: bot.id });

  return {
    sessionState: {
      dialogAction: { type: 'Close' },
      intent: { name: intentName, state: 'Fulfilled' },
    },
    messages: [{ contentType: 'PlainText', content: 'Your redelivery is booked for tomorrow.' }],
  };
});
