import { logger } from '@latcher/base';
import type { CognitoMiddleware } from '@latcher/cognito';

// Matcher middleware: runs once per event, before any route middleware, for every trigger.
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
