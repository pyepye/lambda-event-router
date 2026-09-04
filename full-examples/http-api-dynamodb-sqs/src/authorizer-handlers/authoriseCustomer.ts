import { Authorized, Denied, defineLambdaAuthorizerRoute } from '@lambda-event-router/apigateway';

import { DEMO_TOKEN } from '../utils/auth.js';

export const authoriseCustomer = defineLambdaAuthorizerRoute({
  filters: { type: 'REQUEST' },
}).handle(async ({ headers }) => {
  if (headers.authorization !== DEMO_TOKEN) return Denied();

  return Authorized({ customerId: 'cust-demo' });
});
