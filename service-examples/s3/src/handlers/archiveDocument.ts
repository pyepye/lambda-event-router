import { logger } from '@lambda-event-router/base';
import type { S3ObjectCreatedRequest } from '@lambda-event-router/s3';

export async function archiveDocument(request: S3ObjectCreatedRequest): Promise<void> {
  logger.info({
    message: 'Document stored in the archive',
    key: request.key,
    objectSize: request.objectSize,
  });
}
