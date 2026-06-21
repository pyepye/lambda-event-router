import { logger } from '@lambda-event-router/base';
import type { DocumentDBInsertRequest, DocumentDBResponse } from '@lambda-event-router/documentdb';

import type { TDocumentKey, TStockLevel } from '../utils/schemas.js';

export async function adjustStockLevel(
  request: DocumentDBInsertRequest<TDocumentKey, TStockLevel>,
): Promise<DocumentDBResponse> {
  logger.info({
    message: 'Stock level adjusted',
    stockLevelId: request.documentKey._id.$oid,
    onHand: request.fullDocument.onHand,
  });
}
