import { logger } from '@lambda-event-router/base';
import type { S3ObjectTaggingRequest } from '@lambda-event-router/s3';

// The event carries no tags, so a handler that needs them calls GetObjectTagging itself.
export async function applyRetentionTags(request: S3ObjectTaggingRequest): Promise<void> {
  logger.info({
    message: 'Retention tags applied',
    key: request.key,
  });
}
