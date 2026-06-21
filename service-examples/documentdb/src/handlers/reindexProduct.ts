import { logger } from '@lambda-event-router/base';
import type { DocumentDBResponse, DocumentDBUpdateRequest } from '@lambda-event-router/documentdb';

import type { TDocumentKey, TProduct } from '../utils/schemas.js';

// The products mapping runs on the Default full document setting, so an update carries the changed
// fields and no document. Reindexing needs the id and the field list, so that is enough.
export async function reindexProduct(
  request: DocumentDBUpdateRequest<TDocumentKey, TProduct>,
): Promise<DocumentDBResponse> {
  logger.info({
    message: 'Product reindexed',
    productId: request.documentKey._id.$oid,
    updatedFields: Object.keys(request.updateDescription.updatedFields ?? {}),
    hasFullDocument: request.fullDocument !== undefined,
  });
}
