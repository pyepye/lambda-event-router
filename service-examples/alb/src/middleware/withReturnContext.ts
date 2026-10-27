import type { HTTPMiddleware } from '@latcher/alb';
import { logger } from '@latcher/base';

// Route middleware on PUT /returns/:returnId/note. The body has no schema, so it stays `unknown`
// here and in the handler.
export const withReturnContext: HTTPMiddleware<{ returnId: string }> = async (request, next) => {
  logger.info({
    message: 'Return note authorised',
    returnId: request.path.returnId,
    contentType: request.headers['content-type'],
  });

  return next(request);
};
