import { logger } from '@latcher/base';
import type { S3ObjectRemovedRequest } from '@latcher/s3';

// A delete that names a versionId removes that version for good.
export async function purgeDocumentVersion(request: S3ObjectRemovedRequest): Promise<void> {
  logger.info({
    message: 'Document version purged',
    key: request.key,
    versionId: request.versionId,
  });
}
