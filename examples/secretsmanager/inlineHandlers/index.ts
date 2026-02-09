import { EventRouter } from '@lambda-event-router/base';
import { createSecretsManagerRouter } from '@lambda-event-router/secretsmanager';
import type { Handler } from 'aws-lambda';

import {
  createSecretRoute,
  databaseCreateRoute,
  databaseFinishRoute,
  databaseSetRoute,
  databaseTestRoute,
  finishSecretRoute,
  setSecretRoute,
  testSecretRoute,
} from './handlers/rotationRoutes.js';

const secretsManagerRouter = createSecretsManagerRouter();

// Generic .route() with steps filter — each route defines its own step
secretsManagerRouter.route(createSecretRoute).route(setSecretRoute).route(testSecretRoute).route(finishSecretRoute);

// Convenience methods — step is implied by the method name
secretsManagerRouter
  .createSecret(databaseCreateRoute)
  .setSecret(databaseSetRoute)
  .testSecret(databaseTestRoute)
  .finishSecret(databaseFinishRoute);

const eventRouter = new EventRouter({
  routers: [secretsManagerRouter],
});

export const handler: Handler = eventRouter.handler();
