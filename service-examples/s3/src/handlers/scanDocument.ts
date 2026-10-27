import { logger } from '@latcher/base';
import type { S3ObjectCreatedRequest } from '@latcher/s3';

export async function scanDocument(request: S3ObjectCreatedRequest): Promise<void> {
  logger.info({
    message: 'Document scanned',
    key: request.key,
    objectSize: request.objectSize,
    eTag: request.eTag,
  });
}
