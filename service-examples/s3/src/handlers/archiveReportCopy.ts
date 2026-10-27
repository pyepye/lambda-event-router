import { logger } from '@latcher/base';
import type { S3ObjectCreatedRequest } from '@latcher/s3';

export async function archiveReportCopy(request: S3ObjectCreatedRequest): Promise<void> {
  logger.info({
    message: 'Report copy archived',
    key: request.key,
    objectSize: request.objectSize,
  });
}
