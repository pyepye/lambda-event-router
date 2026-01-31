import type { DocumentDBDeleteRequest, DocumentDBResponse } from '@lambda-event-router/documentdb';

interface OrderDocumentKey {
  _id: string;
}

// DELETE events always have:
//   documentKey - the _id of the deleted document
// DELETE events optionally have (depends on change stream configuration):
//   fullDocumentBeforeChange - requires fullDocumentBeforeChange: 'whenAvailable' | 'required'
// DELETE events never have:
//   fullDocument      - the document no longer exists
//   updateDescription - only present on 'update' events
export async function deleteOrder({
  documentKey,
}: DocumentDBDeleteRequest<OrderDocumentKey>): Promise<DocumentDBResponse> {
  console.log(`Order deleted: ${documentKey._id}`);
}
