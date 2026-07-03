import type { HTTPMiddleware } from '@lambda-event-router/alb';
import { logger } from '@lambda-event-router/base';

// Route middleware on PUT /returns/:returnId/note. The body has no schema, so it stays `unknown`
// here and in the handler.
export const withReturnContext: HTTPMiddleware<
  { returnId: string },
  Record<string, string | undefined>,
  unknown
> = async (request, next) => {
  logger.info({
    message: 'Return note authorised',
    returnId: request.path.returnId,
    contentType: request.headers['content-type'],
  });

  return next(request);
};
