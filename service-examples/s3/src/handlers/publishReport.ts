import { logger } from '@latcher/base';
import type { S3ObjectCreatedRequest } from '@latcher/s3';

// Shares an eventName with scanDocument and differs only by bucket, which is what the bucket
// filter is here to decide.
export async function publishReport(request: S3ObjectCreatedRequest): Promise<void> {
  logger.info({
    message: 'Report published',
    key: request.key,
    objectSize: request.objectSize,
  });
}
