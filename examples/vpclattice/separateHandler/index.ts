import { LambdaRouter } from '@lambda-event-router/base';
import { createVPCLatticeRouter } from '@lambda-event-router/vpclattice';
import type { Handler } from 'aws-lambda';

import { createItem, CreateItemBodySchema, QuerySchema } from './createItem.js';

const apiRouter = createVPCLatticeRouter();

apiRouter.post({
  filters: {
    path: '/orgs/:orgId/items/:itemId',
  },
  bodySchema: CreateItemBodySchema,
  querySchema: QuerySchema,
  handler: createItem,
});

apiRouter.route({
  filters: {
    method: 'PUT',
    path: '/orgs/:orgId/items/:itemId',
  },
  bodySchema: CreateItemBodySchema,
  handler: createItem,
});

apiRouter.route({
  filters: {
    method: 'PUT',
    path: '/orgs/:orgId/items/:itemId',
  },
  handler: createItem,
});

const lambdaRouter = new LambdaRouter({
  routers: [apiRouter],
});

export const handler: Handler = lambdaRouter.handler();
