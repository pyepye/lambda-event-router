import { logger } from '@lambda-event-router/base';
import { defineRoute, NotFound, Ok } from '@lambda-event-router/vpclattice';

import { MOVEMENTS } from '../utils/inventory.js';

// Two path params in one pattern, both typed from the pattern and both handed to the handler.
export const getStockMovement = defineRoute({
  filters: { method: 'GET', path: '/stock/:sku/movements/:movementId' },
}).handle(async (request) => {
  const movement = MOVEMENTS[request.path.movementId];
  if (!movement || movement.sku !== request.path.sku) {
    throw NotFound({ error: `Movement ${request.path.movementId} does not exist for ${request.path.sku}` });
  }

  logger.info({ message: 'Stock movement read', sku: request.path.sku, movementId: movement.movementId });

  return Ok(movement);
});
