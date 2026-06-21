import type { DocumentDBInsertRequest, DocumentDBResponse } from '@lambda-event-router/documentdb';

import type { TDocumentKey, TPayment } from '../utils/schemas.js';

// The gateway is down, so this is the route that fails inside the handler rather than on a schema.
// The distinction shows in the logs: the middleware chain has already run by the time the handler
// throws, so this change has a Handling change line. A change that fails validation has none.
export async function capturePayment(
  request: DocumentDBInsertRequest<TDocumentKey, TPayment>,
): Promise<DocumentDBResponse> {
  throw new Error(`Payment gateway unavailable for ${request.fullDocument.orderReference}`);
}
