import { logger } from '@lambda-event-router/base';
import type { DocumentDBInsertRequest, DocumentDBResponse } from '@lambda-event-router/documentdb';

import type { TDocumentKey, TProduct } from '../utils/schemas.js';

export async function indexProduct(
  request: DocumentDBInsertRequest<TDocumentKey, TProduct>,
): Promise<DocumentDBResponse> {
  logger.info({
    message: 'Product indexed',
    sku: request.fullDocument.sku,
    name: request.fullDocument.name,
    price: request.fullDocument.price,
  });
}
