import type { DocumentDBResponse, DocumentDBUpdateRequest } from '@lambda-event-router/documentdb';

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

interface OldOrderDocument extends OrderDocumentKey {
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  status: string;
  createdAt: string;
}

// UPDATE events always have:
//   documentKey       - the _id of the updated document
//   updateDescription - { updatedFields: Record<string, unknown>, removedFields: string[] }
// UPDATE events optionally have (depends on change stream configuration):
//   fullDocument             - only present if the change stream was opened with
//                              fullDocument: 'updateLookup' (or 'whenAvailable'/'required' on MongoDB 6.0+)
//   fullDocumentBeforeChange - only present if the change stream was opened with
//                              fullDocumentBeforeChange: 'whenAvailable' | 'required' (MongoDB 6.0+)
//
// Whether fullDocument/fullDocumentBeforeChange are optional or required on the request type
// depends on the filters declared when registering this handler (see separateHandlers/index.ts).
// If the route declares fullDocument: ['updateLookup'], the types make fullDocument non-optional.
export async function updateOrder({
  documentKey,
  updateDescription,
  fullDocument,
  fullDocumentBeforeChange,
}: DocumentDBUpdateRequest<OrderDocumentKey, OrderDocument, OldOrderDocument>): Promise<DocumentDBResponse> {
  console.log(`Order ${documentKey._id} updated`);

  // updateDescription is always present on update events
  // updatedFields contains whichever fields changed — the shape is unpredictable
  const { updatedFields, removedFields } = updateDescription;

  if (updatedFields?.status) {
    console.log(`Status changed to: ${updatedFields.status}`);
  }

  if (removedFields && removedFields.length > 0) {
    console.log(`Fields removed: ${removedFields.join(', ')}`);
  }

  // fullDocument/fullDocumentBeforeChange availability depends on the route's filter config
  if (fullDocument) {
    console.log(`Current status: ${fullDocument.status}`);
  }

  if (fullDocumentBeforeChange) {
    console.log(`Previous status: ${fullDocumentBeforeChange.status}`);
  }
}
