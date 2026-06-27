import { defineRoute, NotFound, Ok } from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

import { STOCK } from '../utils/warehouse.js';

// Behind the HTTP API's IAM authorizer, so the caller signs the request with SigV4 and `auth.iam`
// carries the identity API Gateway resolved it to.
export const getStockAudit = defineRoute({
  filters: { method: 'GET', path: '/inventory/:sku/audit' },
}).handle(async (request) => {
  const record = STOCK[request.path.sku];
  if (!record) throw NotFound({ error: `SKU ${request.path.sku} is not stocked` });

  const iam = request.auth?.iam;

  logger.info({
    message: 'Stock audit read',
    sku: record.sku,
    accountId: iam?.accountId,
    userArn: iam?.userArn,
  });

  return Ok({ sku: record.sku, accountId: iam?.accountId });
});
