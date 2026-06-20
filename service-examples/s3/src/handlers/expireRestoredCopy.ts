import { logger } from '@lambda-event-router/base';
import type { S3ObjectRestoreRequest } from '@lambda-event-router/s3';

// Catch-all for restore events, registered after the Post and Completed routes, so the only
// eventName left for it is ObjectRestore:Delete.
export async function expireRestoredCopy(request: S3ObjectRestoreRequest): Promise<void> {
  logger.info({
    message: 'Restored copy expired',
    key: request.key,
    eventName: request.eventName,
  });
}
