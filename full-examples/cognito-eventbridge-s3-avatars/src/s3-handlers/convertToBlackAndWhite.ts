import { logger } from '@lambda-event-router/base';
import type { S3ObjectCreatedRequest } from '@lambda-event-router/s3';

import { toBlackAndWhite } from '../utils/imageProcessing.js';
import { getAvatar, putAvatar } from '../utils/s3.js';

export async function convertToBlackAndWhite(request: S3ObjectCreatedRequest): Promise<void> {
  const { bucket, key } = request;
  const { buffer, contentType } = await getAvatar({ bucket, key });
  const processed = await toBlackAndWhite(buffer, contentType);
  const processedKey = key.replace(/^originals\//, 'processed/');
  await putAvatar({ bucket, key: processedKey, body: processed, contentType });
  logger.info({ message: 'Avatar converted to black and white', key: processedKey });
}
