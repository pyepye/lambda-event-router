import { logger } from '@lambda-event-router/base';
import type { S3ObjectRemovedRequest } from '@lambda-event-router/s3';

// Catch-all for removals, registered after the two bucket-scoped routes, so only a removal from
// somewhere other than the uploads bucket reaches it.
export async function logRemoval(request: S3ObjectRemovedRequest): Promise<void> {
  logger.info({
    message: 'Object removed',
    bucket: request.bucket,
    key: request.key,
    eventName: request.eventName,
  });
}
