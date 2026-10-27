import { logger } from '@latcher/base';
import type { HTTPMiddleware } from '@latcher/vpclattice';

// Route middleware on PUT /stock/:sku. The body has no schema, so it stays `unknown` here and in
// the handler.
export const withStockContext: HTTPMiddleware<{ sku: string }> = async (request, next) => {
  logger.info({
    message: 'Stock replacement authorised',
    sku: request.path.sku,
    contentType: request.headers['content-type'],
  });

  return next(request);
};
