import { createALBRouter } from '@lambda-event-router/alb';
import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { CreateItemBodySchema, createItem, QuerySchema } from './createItem.js';

const apiRouter = createALBRouter();

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

const lambdaRouter = new LambdaRouter({
  routers: [apiRouter],
});

export const handler: Handler = lambdaRouter.handler();
