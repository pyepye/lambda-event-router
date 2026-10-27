import { defineRoute, PermanentRedirect } from '@latcher/apigateway';
import { logger } from '@latcher/base';

// Retired SKU codes moved under /inventory, and the old path answers with a permanent redirect.
export const redirectRetiredSku = defineRoute({
  filters: { method: 'GET', path: '/inventory/retired/:sku' },
}).handle(async (request) => {
  const location = `/inventory/${request.path.sku}`;

  logger.info({ message: 'Retired SKU redirected', sku: request.path.sku, location });

  throw PermanentRedirect(location);
});
