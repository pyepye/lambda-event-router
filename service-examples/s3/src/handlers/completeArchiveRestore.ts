import { logger } from '@lambda-event-router/base';
import type { S3ObjectRestoreRequest } from '@lambda-event-router/s3';

// restoreEventData only carries values on Completed. It is undefined on Post and on Delete.
export async function completeArchiveRestore(request: S3ObjectRestoreRequest): Promise<void> {
  logger.info({
    message: 'Archive restore finished',
    key: request.key,
    lifecycleRestorationExpiryTime: request.restoreEventData?.lifecycleRestorationExpiryTime,
    lifecycleRestoreStorageClass: request.restoreEventData?.lifecycleRestoreStorageClass,
  });
}
