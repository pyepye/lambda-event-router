import { createAPIGatewayRouter } from '@lambda-event-router/apigateway';

import { adjustStock } from './handlers/adjustStock.js';
import { amendOrder } from './handlers/amendOrder.js';
import { amendOrderOnFloor } from './handlers/amendOrderOnFloor.js';
import { bookConsignment } from './handlers/bookConsignment.js';
import { createOrder } from './handlers/createOrder.js';
import { describeStockOptions } from './handlers/describeStockOptions.js';
import { discardStockRecord } from './handlers/discardStockRecord.js';
import { getConsignment } from './handlers/getConsignment.js';
import { getConsignmentLabel } from './handlers/getConsignmentLabel.js';
import { getOrder } from './handlers/getOrder.js';
import { getOrderLine } from './handlers/getOrderLine.js';
import { getStockAudit } from './handlers/getStockAudit.js';
import { getStockLevel } from './handlers/getStockLevel.js';
import { getStockRecord } from './handlers/getStockRecord.js';
import { headStockRecord } from './handlers/headStockRecord.js';
import { listPendingOrders } from './handlers/listPendingOrders.js';
import { quoteCarrierRate } from './handlers/quoteCarrierRate.js';
import { reconcileStock } from './handlers/reconcileStock.js';
import { redirectRetiredSku } from './handlers/redirectRetiredSku.js';
import { uploadOrderManifest } from './handlers/uploadOrderManifest.js';
import { logRequest } from './middleware/logRequest.js';
import { ALLOWED_ORIGIN_SUFFIX, CHANNEL_HEADER, STAFF_ID_HEADER, STAFF_ROLE_HEADER } from './utils/constants.js';
import { NewOrderSchema, OrderAmendmentSchema, OrderSchema, StockAdjustmentSchema } from './utils/schemas.js';

const PREFLIGHT_MAX_AGE_SECONDS = 600;

export const apiRouter = createAPIGatewayRouter({
  middleware: [logRequest],
  cors: {
    origin: (origin) => (origin.endsWith(ALLOWED_ORIGIN_SUFFIX) ? origin : undefined),
    allowedHeaders: ['content-type', STAFF_ID_HEADER, STAFF_ROLE_HEADER, CHANNEL_HEADER],
    exposedHeaders: ['x-order-version', 'x-stock-quantity'],
    credentials: true,
    maxAge: PREFLIGHT_MAX_AGE_SECONDS,
  },
});

// Order matters in one place: amendOrderOnFloor and amendOrder share a method and a path, so the one
// with the custom filter is registered first. Everywhere else the router ranks routes itself, which
// is why /orders/pending is reached despite being registered after /orders/:orderId.
apiRouter
  .route(amendOrderOnFloor)
  .patch({ filters: { path: '/orders/:orderId' }, bodySchema: OrderAmendmentSchema, handler: amendOrder })
  .route(getOrder)
  .get({ filters: { path: '/orders/pending' }, handler: listPendingOrders })
  .post({
    filters: { path: '/orders' },
    bodySchema: NewOrderSchema,
    responseSchema: OrderSchema,
    handler: createOrder,
  })
  .route(getOrderLine)
  .route(uploadOrderManifest)
  .route(getStockLevel)
  .route(getConsignment)
  .route(getConsignmentLabel)
  .route(quoteCarrierRate)
  .route(bookConsignment)
  .route(getStockRecord)
  .route(getStockAudit)
  .head({ filters: { path: '/inventory/:sku' }, handler: headStockRecord })
  .options({ filters: { path: '/inventory/:sku' }, handler: describeStockOptions })
  .put({ filters: { path: '/inventory/:sku' }, bodySchema: StockAdjustmentSchema, handler: adjustStock })
  .route(reconcileStock)
  .delete({ filters: { path: '/inventory/:sku' }, handler: discardStockRecord })
  .route(redirectRetiredSku);
