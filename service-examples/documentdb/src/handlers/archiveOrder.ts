import { logger } from '@lambda-event-router/base';
import type { DocumentDBDeleteRequest, DocumentDBResponse } from '@lambda-event-router/documentdb';

import type { TDocumentKey } from '../utils/schemas.js';

// A delete carries the document key and nothing else, so the archive is keyed on the id alone.
export async function archiveOrder(request: DocumentDBDeleteRequest<TDocumentKey>): Promise<DocumentDBResponse> {
  logger.info({ message: 'Order archived', orderId: request.documentKey._id.$oid });
}
