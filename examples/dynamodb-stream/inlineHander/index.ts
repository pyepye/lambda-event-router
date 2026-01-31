import { EventRouter } from '@lambda-event-router/base';
import { createDynamoDBStreamRouter } from '@lambda-event-router/dynamodb-stream';
import type { Handler } from 'aws-lambda';

import { allEventsRoute } from './handlers/allEventsRoute.js';
import { insertRoute } from './handlers/insertRoute.js';
import { noEventNameRoute } from './handlers/noEventNameRoute.js';
import { orderInsertRoute } from './handlers/orderInsertRoute.js';
import { orderModifyRoute } from './handlers/orderModifyRoute.js';
import { orderRemoveRoute } from './handlers/orderRemoveRoute.js';

const dynamodbStreamRouter = createDynamoDBStreamRouter(); // Defaults to batchItemFailures: false

dynamodbStreamRouter
  .route(insertRoute)
  .route(allEventsRoute)
  .route(noEventNameRoute)
  .route(orderInsertRoute)
  .route(orderModifyRoute)
  .route(orderRemoveRoute);

const eventRouter = new EventRouter({
  routers: [dynamodbStreamRouter],
});

export const handler: Handler = eventRouter.handler();
