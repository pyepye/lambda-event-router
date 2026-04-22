import type { Handler } from 'aws-lambda';

import { createAPIGatewayRouter } from '@lambda-event-router/apigateway';
import { LambdaRouter } from '@lambda-event-router/base';

import { CreateItemBodySchema, createItem, QuerySchema } from './createItem.js';
import { updateItem } from './updateItem.js';

const apiRouter = createAPIGatewayRouter();
// Idea...
// const apiRouter = createAPIGatewayRouter({ contentType: 'text/html' });

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

apiRouter.post({
  filters: {
    path: '/orgs/:orgId/items/',
  },
  // Idea...
  // response: {
  //   statusCode: 201
  //   contentType: 'application/json',
  //   schema: Schema,
  // },
  handler: createItem,
});

const lambdaRouter = new LambdaRouter({
  routers: [apiRouter],
});

export const handler: Handler = lambdaRouter.handler();
