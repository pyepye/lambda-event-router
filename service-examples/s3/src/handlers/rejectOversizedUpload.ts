import { logger } from '@lambda-event-router/base';
import type { S3ObjectCreatedRequest } from '@lambda-event-router/s3';

// Registered first, so an oversized document lands here rather than on scanDocument.
export async function rejectOversizedUpload(request: S3ObjectCreatedRequest): Promise<void> {
  logger.info({
    message: 'Upload rejected as oversized',
    key: request.key,
    objectSize: request.objectSize,
  });
}
