import { defineRoute, Ok } from '@latcher/apigateway';
import { logger } from '@latcher/base';

import { STOCK } from '../utils/warehouse.js';

// Behind an API key rather than an authorizer, so `auth.apiKey` carries the key and its id. The key
// is a credential, so only its id is logged.
export const getStockLevel = defineRoute({
  filters: { method: 'GET', path: '/warehouse/stock' },
}).handle(async (request) => {
  const levels = Object.values(STOCK).map(({ sku, quantity }) => ({ sku, quantity }));

  logger.info({
    message: 'Stock levels read',
    apiKeyId: request.auth?.apiKey?.id,
    hasApiKey: Boolean(request.auth?.apiKey),
  });

  return Ok(levels);
});
