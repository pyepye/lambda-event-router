import { LambdaRouter } from '@lambda-event-router/base';
import { createDocumentDBRouter } from '@lambda-event-router/documentdb';
import type { Handler } from 'aws-lambda';

import { deleteRoute } from './handlers/deleteRoute.js';
import { highValueOrderInsertRoute, insertRoute } from './handlers/insertRoute.js';
import { replaceRoute } from './handlers/replaceRoute.js';
import { updateRoute } from './handlers/updateRoute.js';

const documentDBRouter = createDocumentDBRouter();

documentDBRouter
  .route(insertRoute)
  .route(updateRoute)
  .route(replaceRoute)
  .route(deleteRoute)
  .route(highValueOrderInsertRoute);

const lambdaRouter = new LambdaRouter({
  routers: [documentDBRouter],
});

export const handler: Handler = lambdaRouter.handler();
