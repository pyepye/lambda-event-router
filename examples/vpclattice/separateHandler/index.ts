import { EventRouter } from '@lambda-event-router/base';
import { createVPCLatticeRouter } from '@lambda-event-router/vpclattice';
import type { Handler } from 'aws-lambda';

import { CreateItemBodySchema, createItem, QuerySchema } from './createItem.js';

const apiRouter = createVPCLatticeRouter();

apiRouter.post({
  path: '/orgs/:orgId/items/:itemId',
  handler: createItem,
  bodySchema: CreateItemBodySchema,
  querySchema: QuerySchema,
});

apiRouter.route({
  method: 'PUT',
  path: '/orgs/:orgId/items/:itemId',
  handler: createItem,
  bodySchema: CreateItemBodySchema,
});

apiRouter.route({
  method: 'PUT',
  path: '/orgs/:orgId/items/:itemId',
  handler: createItem,
});

const eventRouter = new EventRouter({
  routers: [apiRouter],
});

export const handler: Handler = eventRouter.handler();
