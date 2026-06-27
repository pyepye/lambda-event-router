import { defineRoute, Ok } from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

import { STOCK } from '../utils/warehouse.js';

// Behind an API key rather than an authorizer, so `auth` carries the key's id. The key value lands
// in `auth.apiKey`, which is a credential, so only its id is logged.
export const getStockLevel = defineRoute({
  filters: { method: 'GET', path: '/warehouse/stock' },
}).handle(async (request) => {
  const levels = Object.values(STOCK).map(({ sku, quantity }) => ({ sku, quantity }));

  logger.info({
    message: 'Stock levels read',
    apiKeyId: request.auth?.apiKeyId,
    hasApiKey: Boolean(request.auth?.apiKey),
  });

  return Ok(levels);
});
