import { BinaryBody, createVPCLatticeRouter } from '@lambda-event-router/vpclattice';

import { adjustStockLevel } from './handlers/adjustStockLevel.js';
import { adjustStockOnFloor } from './handlers/adjustStockOnFloor.js';
import { createStockItem } from './handlers/createStockItem.js';
import { describeStockItem } from './handlers/describeStockItem.js';
import { discardStockItem } from './handlers/discardStockItem.js';
import { exportStockValuation } from './handlers/exportStockValuation.js';
import { getStockItem } from './handlers/getStockItem.js';
import { getStockMovement } from './handlers/getStockMovement.js';
import { headStockItem } from './handlers/headStockItem.js';
import { listAvailableStock } from './handlers/listAvailableStock.js';
import { listSupplierSkus } from './handlers/listSupplierSkus.js';
import { raiseReorder } from './handlers/raiseReorder.js';
import { redirectRetiredSku } from './handlers/redirectRetiredSku.js';
import { replaceStockItem } from './handlers/replaceStockItem.js';
import { valueStockHolding } from './handlers/valueStockHolding.js';
import { logRequest } from './middleware/logRequest.js';
import { withStockContext } from './middleware/withStockContext.js';
import { withStocktakeFreeze } from './middleware/withStocktakeFreeze.js';
import { ALLOWED_ORIGIN_SUFFIX, CHANNEL_HEADER, DEPOT_HEADER, STOCK_VERSION_HEADER } from './utils/constants.js';
import { AvailableStockSchema, NewStockItemSchema, StockAdjustmentSchema } from './utils/schemas.js';

const PREFLIGHT_MAX_AGE_SECONDS = 600;

export const inventoryRouter = createVPCLatticeRouter({
  middleware: [logRequest],
  cors: {
    origin: (origin) => (origin.endsWith(ALLOWED_ORIGIN_SUFFIX) ? origin : undefined),
    allowedHeaders: ['content-type', CHANNEL_HEADER, DEPOT_HEADER],
    exposedHeaders: [STOCK_VERSION_HEADER],
    credentials: true,
    maxAge: PREFLIGHT_MAX_AGE_SECONDS,
  },
});

// The router ranks routes itself, which is why /stock/available is reached despite being registered
// after /stock/:sku, and why adjustStockOnFloor's custom filter is asked before adjustStockLevel takes
// the same method and path.
inventoryRouter
  .route(adjustStockOnFloor)
  .patch({ filters: { path: '/stock/:sku' }, bodySchema: StockAdjustmentSchema, handler: adjustStockLevel })
  .route(getStockItem)
  .get({ filters: { path: '/stock/available' }, responseSchema: AvailableStockSchema, handler: listAvailableStock })
  .head({ filters: { path: '/stock/:sku' }, handler: headStockItem })
  .options({ filters: { path: '/stock/:sku' }, handler: describeStockItem })
  .post({ filters: { path: '/stock' }, bodySchema: NewStockItemSchema, handler: createStockItem })
  .put({
    filters: { path: '/stock/:sku' },
    middleware: [withStocktakeFreeze, withStockContext],
    bodySchema: BinaryBody,
    handler: replaceStockItem,
  })
  .delete({ filters: { path: '/stock/:sku' }, handler: discardStockItem })
  .route(redirectRetiredSku)
  .route(getStockMovement)
  .route(listSupplierSkus)
  .route(valueStockHolding)
  .route(exportStockValuation)
  .route(raiseReorder);
