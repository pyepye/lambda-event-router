import { logger } from '@latcher/base';
import type { S3LifecycleExpirationRequest } from '@latcher/s3';

export async function recordLifecycleDeleteMarker(request: S3LifecycleExpirationRequest): Promise<void> {
  logger.info({
    message: 'Lifecycle delete marker recorded',
    key: request.key,
    versionId: request.versionId,
  });
}
