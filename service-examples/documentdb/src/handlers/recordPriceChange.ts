import { logger } from '@latcher/base';
import type { DocumentDBInsertRequest, DocumentDBResponse } from '@latcher/documentdb';

import type { TDocumentKey, TPriceHistory } from '../utils/schemas.js';

export async function recordPriceChange(
  request: DocumentDBInsertRequest<TDocumentKey, TPriceHistory>,
): Promise<DocumentDBResponse> {
  logger.info({
    message: 'Price recorded',
    sku: request.fullDocument.sku,
    price: request.fullDocument.price,
  });
}
