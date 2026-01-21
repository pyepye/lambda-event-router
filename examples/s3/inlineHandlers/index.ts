import type { Handler } from 'aws-lambda';

import { EventRouter } from '@lambda-event-router/base';
import { createS3Router } from '@lambda-event-router/s3';

import { objectCreatedPutImageRoute, objectCreatedRoute, objectCreatedThumbnailRoute } from './handlers/objectCreatedRoute.js';

const s3Router = createS3Router();

// Register ObjectCreated routes using generic route method
s3Router.route(objectCreatedRoute).route(objectCreatedPutImageRoute).route(objectCreatedThumbnailRoute);

const eventRouter = new EventRouter({
  routers: [s3Router],
});

export const handler: Handler = eventRouter.handler();
