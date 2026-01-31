import type { DocumentDBReplaceRequest, DocumentDBResponse } from '@lambda-event-router/documentdb';

interface OrderDocumentKey {
  _id: string;
}

interface OrderDocument extends OrderDocumentKey {
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered';
  createdAt: string;
}

// REPLACE events always have:
//   documentKey  - the _id of the replaced document
//   fullDocument - the full replacement document (always present, no config needed)
// REPLACE events optionally have (depends on change stream configuration):
//   fullDocumentBeforeChange - only present if the change stream was opened with
//                              fullDocumentBeforeChange: 'whenAvailable' | 'required' (MongoDB 6.0+)
// REPLACE events never have:
//   updateDescription - only present on 'update' events
export async function replaceOrder({
  documentKey,
  fullDocument,
}: DocumentDBReplaceRequest<OrderDocumentKey, OrderDocument>): Promise<DocumentDBResponse> {
  console.log(`Order ${documentKey._id} replaced`);
  console.log(`New status: ${fullDocument.status}, total: ${fullDocument.total}`);
}
