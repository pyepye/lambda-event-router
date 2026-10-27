import { logger } from '@latcher/base';
import type { S3ObjectRestoreRequest } from '@latcher/s3';

// Fires on the RestoreObject call itself, so it lands within seconds of the trigger.
export async function beginArchiveRestore(request: S3ObjectRestoreRequest): Promise<void> {
  logger.info({
    message: 'Archive restore started',
    key: request.key,
    versionId: request.versionId,
  });
}
