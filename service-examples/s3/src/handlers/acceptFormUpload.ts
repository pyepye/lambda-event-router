import { logger } from '@latcher/base';
import type { S3ObjectCreatedRequest } from '@latcher/s3';

// Browser form posts land here. Only a presigned POST produces ObjectCreated:Post; PutObject does not.
export async function acceptFormUpload(request: S3ObjectCreatedRequest): Promise<void> {
  logger.info({
    message: 'Form upload accepted',
    key: request.key,
    objectSize: request.objectSize,
  });
}
