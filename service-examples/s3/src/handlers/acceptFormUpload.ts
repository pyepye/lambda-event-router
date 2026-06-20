import { logger } from '@lambda-event-router/base';
import type { S3ObjectCreatedRequest } from '@lambda-event-router/s3';

// Browser form posts land here. Only a presigned POST produces ObjectCreated:Post; PutObject does not.
export async function acceptFormUpload(request: S3ObjectCreatedRequest): Promise<void> {
  logger.info({
    message: 'Form upload accepted',
    key: request.key,
    objectSize: request.objectSize,
  });
}
