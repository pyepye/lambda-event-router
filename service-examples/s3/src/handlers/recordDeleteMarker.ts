import { logger } from '@latcher/base';
import type { S3ObjectRemovedRequest } from '@latcher/s3';

// A delete with no versionId on a versioned bucket hides the object behind a delete marker. The
// versionId on the record is the marker's, not the object's.
export async function recordDeleteMarker(request: S3ObjectRemovedRequest): Promise<void> {
  logger.info({
    message: 'Delete marker recorded',
    key: request.key,
    versionId: request.versionId,
  });
}
