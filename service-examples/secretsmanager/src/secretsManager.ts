import { createSecretsManagerRouter } from '@lambda-event-router/secretsmanager';

import { announceRotation } from './handlers/announceRotation.js';
import { checkWebhookKey } from './handlers/checkWebhookKey.js';
import { createPendingToken } from './handlers/createPendingToken.js';
import { holdPausedRotation } from './handlers/holdPausedRotation.js';
import { promoteToken } from './handlers/promoteToken.js';
import { rejectIndexKey } from './handlers/rejectIndexKey.js';
import { verifyPaymentsToken } from './handlers/verifyPaymentsToken.js';
import { logRotationStep } from './middleware/logRotationStep.js';

export const secretsManagerRouter = createSecretsManagerRouter({
  middleware: [logRotationStep],
});

// Order matters twice. holdPausedRotation is first so a paused secret never reaches a rotation
// route, and checkWebhookKey is ahead of announceRotation because both match the webhook key on
// setSecret.
secretsManagerRouter
  .route(holdPausedRotation)
  .createSecret(createPendingToken)
  .testSecret(rejectIndexKey)
  .route(checkWebhookKey)
  .setSecret(announceRotation)
  .testSecret(verifyPaymentsToken)
  .finishSecret(promoteToken);
