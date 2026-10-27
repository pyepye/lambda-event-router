import { logger } from '@latcher/base';
import type { DocumentDBInsertRequest, DocumentDBResponse } from '@latcher/documentdb';

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
