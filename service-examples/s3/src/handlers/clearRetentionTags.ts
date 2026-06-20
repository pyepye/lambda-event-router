import { logger } from '@lambda-event-router/base';
import type { S3ObjectTaggingRequest } from '@lambda-event-router/s3';

export async function clearRetentionTags(request: S3ObjectTaggingRequest): Promise<void> {
  logger.info({
    message: 'Retention tags cleared',
    key: request.key,
  });
}
