import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/secretsmanager';

import { SECRET_ARN } from '../config.js';

export const sendToDownstream = defineRoute({
  filters: {
    secretId: SECRET_ARN,
  },
}).handle(async (request) => {
  // Would send the pending secret to the system that uses it here
  logger.info({ message: 'Pending secret sent to downstream', secretId: request.secretId });
});
