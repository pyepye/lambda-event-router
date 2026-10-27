import { logger } from '@latcher/base';
import type { S3ObjectRestoreRequest } from '@latcher/s3';

// Catch-all for restore events, registered after the Post and Completed routes, so the only
// eventName left for it is ObjectRestore:Delete.
export async function expireRestoredCopy(request: S3ObjectRestoreRequest): Promise<void> {
  logger.info({
    message: 'Restored copy expired',
    key: request.key,
    eventName: request.eventName,
  });
}
