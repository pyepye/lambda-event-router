import { defineLambdaAuthorizerRoute, generatePolicy } from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

import { READ_METHODS, STAFF_ID_HEADER } from '../utils/constants.js';

// The REST API's REQUEST authorizer for read-only methods. A `method` filter takes one method, so a
// custom filter is how one route covers a group of them.
export const authoriseWarehouseRead = defineLambdaAuthorizerRoute({
  filters: {
    type: 'REQUEST',
    custom: ({ method }) => method !== undefined && READ_METHODS.includes(method),
  },
}).handle(async ({ headers, method, resourceArn }) => {
  const staffId = headers[STAFF_ID_HEADER];

  logger.info({ message: 'Warehouse read checked', method, staffId });

  return generatePolicy(staffId ?? 'anonymous', staffId ? 'Allow' : 'Deny', resourceArn);
});
