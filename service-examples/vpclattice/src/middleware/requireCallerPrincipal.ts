import { logger } from '@lambda-event-router/base';
import { type HTTPMiddleware, Unauthorized } from '@lambda-event-router/vpclattice';

// Route middleware on GET /suppliers/:supplierId/skus. An unsigned caller arrives with no
// identity, so the same request answers 200 signed and 401 unsigned on either listener.
export const requireCallerPrincipal: HTTPMiddleware<{ supplierId: string }> = async (request, next) => {
  if (!request.auth?.principalId) {
    logger.warn({ message: 'Supplier read refused, no caller principal', supplierId: request.path.supplierId });
    throw Unauthorized('The caller has no principal');
  }

  logger.info({
    message: 'Supplier read authorised',
    supplierId: request.path.supplierId,
    principalId: request.auth.principalId,
  });

  return next(request);
};
