import { EventRouter } from '@lambda-event-router/base';
import { createCodePipelineRouter } from '@lambda-event-router/codepipeline';
import type { Handler } from 'aws-lambda';

import { continuationRoute } from './handlers/continuationRoute.js';
import { continuationDeployRoute, deployActionRoute } from './handlers/deployActionRoute.js';
import { processArtifactsRoute } from './handlers/processArtifactsRoute.js';

const codePipelineRouter = createCodePipelineRouter();

codePipelineRouter
  .route(processArtifactsRoute)
  .route(continuationRoute)
  .route(deployActionRoute)
  .route(continuationDeployRoute);

const eventRouter = new EventRouter({
  routers: [codePipelineRouter],
});

export const handler: Handler = eventRouter.handler();
