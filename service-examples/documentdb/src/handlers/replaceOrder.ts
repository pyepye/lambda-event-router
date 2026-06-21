import { logger } from '@lambda-event-router/base';
import type { DocumentDBReplaceRequest, DocumentDBResponse } from '@lambda-event-router/documentdb';

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
