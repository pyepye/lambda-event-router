import { logger } from '@lambda-event-router/base';
import type { S3LifecycleExpirationRequest } from '@lambda-event-router/s3';

// A lifecycle rule removing a noncurrent version reports LifecycleExpiration:Delete, not
// ObjectRemoved:Delete.
export async function purgeExpiredVersion(request: S3LifecycleExpirationRequest): Promise<void> {
  logger.info({
    message: 'Expired version purged by lifecycle',
    key: request.key,
    versionId: request.versionId,
  });
}
