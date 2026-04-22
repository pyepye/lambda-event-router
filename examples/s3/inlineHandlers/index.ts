import type { Handler } from 'aws-lambda';

import { LambdaRouter } from '@lambda-event-router/base';
import { createS3Router } from '@lambda-event-router/s3';

import {
  largeFileUploadRoute,
  objectCreatedPutImageRoute,
  objectCreatedRoute,
  objectCreatedThumbnailRoute,
} from './handlers/objectCreatedRoute.js';

const s3Router = createS3Router();

// Register ObjectCreated routes using generic route method
s3Router
  .route(objectCreatedRoute)
  .route(objectCreatedPutImageRoute)
  .route(objectCreatedThumbnailRoute)
  .route(largeFileUploadRoute);

const lambdaRouter = new LambdaRouter({
  routers: [s3Router],
});

export const handler: Handler = lambdaRouter.handler();
