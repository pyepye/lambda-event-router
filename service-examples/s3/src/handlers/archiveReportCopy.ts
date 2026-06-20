import { logger } from '@lambda-event-router/base';
import type { S3ObjectCreatedRequest } from '@lambda-event-router/s3';

export async function archiveReportCopy(request: S3ObjectCreatedRequest): Promise<void> {
  logger.info({
    message: 'Report copy archived',
    key: request.key,
    objectSize: request.objectSize,
  });
}
