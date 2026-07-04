import type { AppSyncResolverMiddleware } from '@lambda-event-router/appsync';
import { isObject, logger } from '@lambda-event-router/base';

// Router middleware: runs once per resolver invocation, before any route middleware.
export const logResolverRequest: AppSyncResolverMiddleware = async (request, next) => {
  const resolverContext = isObject(request.identity) ? request.identity.resolverContext : undefined;

  logger.info({
    message: 'Handling resolver request',
    field: `${request.info.parentTypeName}.${request.info.fieldName}`,
    selectionSet: request.info.selectionSetList,
    role: isObject(resolverContext) ? resolverContext.role : undefined,
  });

  return next(request);
};
