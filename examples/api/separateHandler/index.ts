import type { Handler } from 'aws-lambda';

import { createApiRouter } from '@lambda-event-router/api';
import { EventRouter } from '@lambda-event-router/base';

import { CreateItemBodySchema, QuerySchema, createItem } from './createItem.js';

const apiRouter = createApiRouter();

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
