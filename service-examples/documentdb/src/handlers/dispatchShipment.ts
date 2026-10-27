import { logger } from '@latcher/base';
import type { DocumentDBInsertRequest, DocumentDBResponse } from '@latcher/documentdb';

import type { TDocumentKey, TShipment } from '../utils/schemas.js';

export async function dispatchShipment(
  request: DocumentDBInsertRequest<TDocumentKey, TShipment>,
): Promise<DocumentDBResponse> {
  logger.info({
    message: 'Shipment dispatched',
    orderReference: request.fullDocument.orderReference,
    carrier: request.fullDocument.carrier,
  });
}
