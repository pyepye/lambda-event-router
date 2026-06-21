import { logger } from '@lambda-event-router/base';
import type { DocumentDBMiddleware } from '@lambda-event-router/documentdb';

import type { TDocumentKey, TOrder } from '../utils/schemas.js';

// Route middleware for the orders collection. Typed to the route's documents so it slots onto
// createOrder without widening it.
export const withOrderContext: DocumentDBMiddleware<TDocumentKey, TOrder> = async (request, next) => {
  logger.info({ message: 'Order change received', orderId: request.documentKey._id.$oid });
  await next(request);
};
