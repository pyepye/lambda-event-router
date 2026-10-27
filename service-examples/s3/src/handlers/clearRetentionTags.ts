import { logger } from '@latcher/base';
import type { S3ObjectTaggingRequest } from '@latcher/s3';

export async function clearRetentionTags(request: S3ObjectTaggingRequest): Promise<void> {
  logger.info({
    message: 'Retention tags cleared',
    key: request.key,
  });
}
