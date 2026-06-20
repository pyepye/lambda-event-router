import { logger } from '@lambda-event-router/base';
import type { S3ObjectCreatedRequest } from '@lambda-event-router/s3';

export async function scanDocument(request: S3ObjectCreatedRequest): Promise<void> {
  logger.info({
    message: 'Document scanned',
    key: request.key,
    objectSize: request.objectSize,
    eTag: request.eTag,
  });
}
