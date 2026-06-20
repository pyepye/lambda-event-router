import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/s3';

import { UPLOADS_BUCKET } from '../config.js';

// The only route built with defineRoute and router.route(), which is the one form that takes an
// explicit eventName. A regular expression picks out the extensions the vault refuses to store.
export const quarantineExecutable = defineRoute({
  filters: {
    eventName: ['ObjectCreated:Put', 'ObjectCreated:Copy'],
    bucket: UPLOADS_BUCKET,
    key: /\.(exe|bat|sh)$/,
  },
}).handle(async (request) => {
  logger.info({
    message: 'Executable quarantined',
    key: request.key,
    eventName: request.eventName,
    objectSize: request.objectSize,
  });
});
