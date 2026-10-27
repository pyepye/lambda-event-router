import { logger } from '@latcher/base';
import type { S3ObjectCreatedRequest } from '@latcher/s3';

export async function archiveDocument(request: S3ObjectCreatedRequest): Promise<void> {
  logger.info({
    message: 'Document stored in the archive',
    key: request.key,
    objectSize: request.objectSize,
  });
}
