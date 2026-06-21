import { createDocumentDBRouter } from '@lambda-event-router/documentdb';

import { CLUSTER_ARN } from './config.js';
import { adjustStockLevel } from './handlers/adjustStockLevel.js';
import { applyOrderDiscount } from './handlers/applyOrderDiscount.js';
import { archiveOrder } from './handlers/archiveOrder.js';
import { capturePayment } from './handlers/capturePayment.js';
import { comparePriceChange } from './handlers/comparePriceChange.js';
import { createOrder } from './handlers/createOrder.js';
import { dispatchShipment } from './handlers/dispatchShipment.js';
import { escalateHighValueOrder } from './handlers/escalateHighValueOrder.js';
import { indexProduct } from './handlers/indexProduct.js';
import { recordInvoice } from './handlers/recordInvoice.js';
import { recordPriceChange } from './handlers/recordPriceChange.js';
import { reindexProduct } from './handlers/reindexProduct.js';
import { replaceOrder } from './handlers/replaceOrder.js';
import { logChange } from './middleware/logChange.js';
import { withOrderContext } from './middleware/withOrderContext.js';
import { COLLECTIONS, DATABASES } from './utils/cluster.js';
import {
  DocumentKeySchema,
  OrderSchema,
  PaymentSchema,
  PriceHistorySchema,
  ProductSchema,
  ShipmentSchema,
  StockLevelSchema,
} from './utils/schemas.js';

export const documentDBRouter = createDocumentDBRouter({ middleware: [logChange] });

// Order matters: escalateHighValueOrder's custom filter must win over createOrder for a large order,
// so it is registered first.
documentDBRouter
  .route(escalateHighValueOrder)
  .insert({
    filters: { eventSourceArn: CLUSTER_ARN, database: DATABASES.storefront, collection: COLLECTIONS.orders },
    documentKeySchema: DocumentKeySchema,
    fullDocumentSchema: OrderSchema,
    middleware: [withOrderContext],
    handler: createOrder,
  })
  .route(applyOrderDiscount)
  .replace({
    filters: { eventSourceArn: CLUSTER_ARN, database: DATABASES.storefront, collection: COLLECTIONS.orders },
    documentKeySchema: DocumentKeySchema,
    fullDocumentSchema: OrderSchema,
    handler: replaceOrder,
  })
  .delete({
    filters: { eventSourceArn: CLUSTER_ARN, database: DATABASES.storefront, collection: COLLECTIONS.orders },
    documentKeySchema: DocumentKeySchema,
    handler: archiveOrder,
  })
  .route(recordInvoice)
  .insert({
    filters: { eventSourceArn: CLUSTER_ARN, database: DATABASES.catalogue, collection: COLLECTIONS.products },
    documentKeySchema: DocumentKeySchema,
    fullDocumentSchema: ProductSchema,
    handler: indexProduct,
  })
  .update({
    filters: { eventSourceArn: CLUSTER_ARN, database: DATABASES.catalogue, collection: COLLECTIONS.products },
    documentKeySchema: DocumentKeySchema,
    handler: reindexProduct,
  })
  .insert({
    filters: { eventSourceArn: CLUSTER_ARN, database: DATABASES.fulfilment, collection: COLLECTIONS.payments },
    documentKeySchema: DocumentKeySchema,
    fullDocumentSchema: PaymentSchema,
    handler: capturePayment,
  })
  .insert({
    filters: { eventSourceArn: CLUSTER_ARN, database: DATABASES.fulfilment, collection: COLLECTIONS.shipments },
    documentKeySchema: DocumentKeySchema,
    fullDocumentSchema: ShipmentSchema,
    handler: dispatchShipment,
  })
  .insert({
    filters: { eventSourceArn: CLUSTER_ARN, database: DATABASES.fulfilment, collection: COLLECTIONS.stockLevels },
    documentKeySchema: DocumentKeySchema,
    fullDocumentSchema: StockLevelSchema,
    handler: adjustStockLevel,
  })
  .insert({
    filters: { eventSourceArn: CLUSTER_ARN, database: DATABASES.fulfilment, collection: COLLECTIONS.priceHistory },
    documentKeySchema: DocumentKeySchema,
    fullDocumentSchema: PriceHistorySchema,
    handler: recordPriceChange,
  })
  .route(comparePriceChange);
