import { logger } from '@lambda-event-router/base';
import type { CognitoMiddleware } from '@lambda-event-router/cognito';

// Router middleware: runs once per event, before any route middleware, for every trigger.
export const logInvocation: CognitoMiddleware = async (request, next) => {
  logger.info({
    message: 'Handling Cognito trigger',
    triggerSource: request.triggerSource,
    userPoolId: request.event.userPoolId,
    userName: request.event.userName,
    clientId: request.event.callerContext.clientId,
  });
  return next(request);
};
