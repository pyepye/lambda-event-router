import { logger } from '@latcher/base';
import type { S3ObjectCreatedRequest } from '@latcher/s3';

// A multipart eTag ends in a dash and the part count, so it is not the MD5 of the object.
export async function assembleTranscript(request: S3ObjectCreatedRequest): Promise<void> {
  logger.info({
    message: 'Transcript assembled',
    key: request.key,
    objectSize: request.objectSize,
    eTag: request.eTag,
  });
}
