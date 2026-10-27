import { logger } from '@latcher/base';
import { Conflict, type HTTPMiddleware } from '@latcher/vpclattice';

import { STOCKTAKE_FROZEN, STOCKTAKE_HEADER } from '../utils/constants.js';

// Route middleware on PUT /stock/:sku. A frozen depot answers without the handler running, which
// is the other way a middleware can end a request.
export const withStocktakeFreeze: HTTPMiddleware<{ sku: string }> = async (request, next) => {
  if (request.headers[STOCKTAKE_HEADER] === STOCKTAKE_FROZEN) {
    logger.info({ message: 'Stock replacement frozen for the stocktake', sku: request.path.sku });
    return Conflict(`SKU ${request.path.sku} is being counted`);
  }

  return next(request);
};
