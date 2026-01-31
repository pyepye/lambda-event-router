import type { DocumentDBInsertRequest, DocumentDBResponse } from '@lambda-event-router/documentdb';

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

// INSERT events always have:
//   documentKey  - the _id of the inserted document
//   fullDocument - the full inserted document
// INSERT events never have:
//   updateDescription          - only present on 'update' events
//   fullDocumentBeforeChange   - no previous document exists for an insert
export async function insertOrder({
  fullDocument,
  documentKey,
}: DocumentDBInsertRequest<OrderDocumentKey, OrderDocument>): Promise<DocumentDBResponse> {
  console.log(`New order: ${documentKey._id} for customer ${fullDocument.customerId}`);
  console.log(`Items: ${fullDocument.items.length}, total: ${fullDocument.total}`);
}
