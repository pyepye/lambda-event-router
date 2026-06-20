import { logger } from '@lambda-event-router/base';
import type { S3ObjectRemovedRequest } from '@lambda-event-router/s3';

// A delete that names a versionId removes that version for good.
export async function purgeDocumentVersion(request: S3ObjectRemovedRequest): Promise<void> {
  logger.info({
    message: 'Document version purged',
    key: request.key,
    versionId: request.versionId,
  });
}
