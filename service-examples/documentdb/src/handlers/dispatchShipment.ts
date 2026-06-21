import { logger } from '@lambda-event-router/base';
import type { DocumentDBInsertRequest, DocumentDBResponse } from '@lambda-event-router/documentdb';

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
