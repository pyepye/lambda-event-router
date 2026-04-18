import { createAPIGatewayRouter } from '@lambda-event-router/apigateway';
import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { CreateItemBodySchema, createItem, QuerySchema } from './createItem.js';

const apiRouter = createAPIGatewayRouter();

apiRouter.post({
  filters: {
    path: '/orgs/:orgId/items/:itemId',
  },
  handler: createItem,
  bodySchema: CreateItemBodySchema,
  querySchema: QuerySchema,
});

apiRouter.route({
  filters: {
    method: 'PUT',
    path: '/orgs/:orgId/items/:itemId',
  },
  handler: createItem,
  bodySchema: CreateItemBodySchema,
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
