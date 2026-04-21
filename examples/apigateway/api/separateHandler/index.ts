import { createAPIGatewayRouter } from '@lambda-event-router/apigateway';
import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { createItem, CreateItemBodySchema, QuerySchema } from './createItem.js';
import { updateItem } from './updateItem.js';

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

apiRouter.patch({
  filters: {
    path: '/orgs/:orgId/items/:itemId',
  },
  handler: updateItem,
});

const lambdaRouter = new LambdaRouter({
  routers: [apiRouter],
});

export const handler: Handler = lambdaRouter.handler();
