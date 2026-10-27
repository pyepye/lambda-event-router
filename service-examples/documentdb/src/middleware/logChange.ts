import { logger } from '@latcher/base';
import type { DocumentDBMiddleware } from '@latcher/documentdb';

// Matcher middleware: runs once per change, for every collection, before any route middleware.
export const logChange: DocumentDBMiddleware = async (request, next) => {
  logger.info({
    message: 'Handling change',
    operationType: request.operationType,
    database: request.changeEvent.ns.db,
    collection: request.changeEvent.ns.coll,
    documentKey: request.changeEvent.documentKey,
  });
  await next(request);
};
