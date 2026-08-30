import { createSecretsManagerRouter } from '@lambda-event-router/secretsmanager';

import { logRotationStep } from './middleware/logInvocation.js';
import { checkPwnedPasswords } from './secretsmanager-handlers/checkPwnedPasswords.js';
import { createPendingSecret } from './secretsmanager-handlers/createPendingSecret.js';
import { promotePendingSecret } from './secretsmanager-handlers/promotePendingSecret.js';
import { sendToDownstream } from './secretsmanager-handlers/sendToDownstream.js';

export const secretsManagerRouter = createSecretsManagerRouter({
  middleware: [logRotationStep],
});

secretsManagerRouter
  .createSecret(createPendingSecret)
  .setSecret(sendToDownstream)
  .testSecret(checkPwnedPasswords)
  .finishSecret(promotePendingSecret);
