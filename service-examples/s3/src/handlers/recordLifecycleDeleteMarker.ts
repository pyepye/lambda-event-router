import { logger } from '@lambda-event-router/base';
import type { S3LifecycleExpirationRequest } from '@lambda-event-router/s3';

export async function recordLifecycleDeleteMarker(request: S3LifecycleExpirationRequest): Promise<void> {
  logger.info({
    message: 'Lifecycle delete marker recorded',
    key: request.key,
    versionId: request.versionId,
  });
}
