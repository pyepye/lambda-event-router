import { logger } from '@lambda-event-router/base';
import type { LexMiddleware } from '@lambda-event-router/lex';

// Router middleware: runs once per turn, before any route middleware, for every matched route.
export const logTurn: LexMiddleware = async (request, next) => {
  logger.info({
    message: 'Handling Lex turn',
    intentName: request.intentName,
    invocationSource: request.invocationSource,
    inputMode: request.event.inputMode,
    botId: request.bot.id,
    sessionId: request.event.sessionId,
    requestId: request.context.awsRequestId,
  });
  return next(request);
};
