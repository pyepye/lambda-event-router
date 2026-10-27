import { logger } from '@latcher/base';
import type { DocumentDBReplaceRequest, DocumentDBResponse } from '@latcher/documentdb';

import type { TDocumentKey, TOrder } from '../utils/schemas.js';

export async function replaceOrder(
  request: DocumentDBReplaceRequest<TDocumentKey, TOrder>,
): Promise<DocumentDBResponse> {
  logger.info({
    message: 'Order replaced',
    reference: request.fullDocument.reference,
    status: request.fullDocument.status,
    total: request.fullDocument.total,
  });
}
