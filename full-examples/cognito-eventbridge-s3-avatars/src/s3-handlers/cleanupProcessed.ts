import { logger } from '@latcher/base';
import type { S3ObjectRemovedRequest } from '@latcher/s3';

import { deleteAvatar } from '../utils/s3.js';

export async function cleanupProcessed(request: S3ObjectRemovedRequest): Promise<void> {
  const { bucket, key } = request;
  const processedKey = key.replace(/^originals\//, 'processed/');
  await deleteAvatar({ bucket, key: processedKey });
  logger.info({ message: 'Processed avatar removed', key: processedKey });
}
