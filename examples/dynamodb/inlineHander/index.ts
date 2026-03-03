import { EventRouter } from '@lambda-event-router/base';
import { createDynamoDBRouter } from '@lambda-event-router/dynamodb';
import type { Handler } from 'aws-lambda';

import { allEventsRoute } from './handlers/allEventsRoute.js';
import { insertRoute, pendingStatusInsertRoute } from './handlers/insertRoute.js';
import { noEventNameRoute } from './handlers/noEventNameRoute.js';
import { orderInsertRoute } from './handlers/orderInsertRoute.js';
import { orderModifyRoute } from './handlers/orderModifyRoute.js';
import { orderRemoveRoute } from './handlers/orderRemoveRoute.js';

const dynamodbStreamRouter = createDynamoDBRouter(); // Defaults to batchItemFailures: false

dynamodbStreamRouter
  .route(insertRoute)
  .route(allEventsRoute)
  .route(noEventNameRoute)
  .route(orderInsertRoute)
  .route(orderModifyRoute)
  .route(orderRemoveRoute)
  .route(pendingStatusInsertRoute);

const eventRouter = new EventRouter({
  routers: [dynamodbStreamRouter],
});

export const handler: Handler = eventRouter.handler();
