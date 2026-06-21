import { logger } from '@lambda-event-router/base';
import type { DocumentDBInsertRequest, DocumentDBResponse } from '@lambda-event-router/documentdb';

import type { TDocumentKey, TOrder } from '../utils/schemas.js';

// deliveredDocument is the untouched change event document, which is how the log shows the extended
// JSON that DocumentDB actually sends.
export async function createOrder(request: DocumentDBInsertRequest<TDocumentKey, TOrder>): Promise<DocumentDBResponse> {
  logger.info({
    message: 'Order created',
    reference: request.fullDocument.reference,
    customer: request.fullDocument.customer,
    total: request.fullDocument.total,
    deliveredDocument: request.changeEvent.fullDocument,
  });
}
