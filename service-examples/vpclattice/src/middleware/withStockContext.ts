import { logger } from '@lambda-event-router/base';
import type { HTTPMiddleware } from '@lambda-event-router/vpclattice';

// Route middleware on PUT /stock/:sku. The body has no schema, so it stays `unknown` here and in
// the handler.
export const withStockContext: HTTPMiddleware<{ sku: string }, Record<string, string | undefined>, unknown> = async (
  request,
  next,
) => {
  logger.info({
    message: 'Stock replacement authorised',
    sku: request.path.sku,
    contentType: request.headers['content-type'],
  });

  return next(request);
};
