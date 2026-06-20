import { logger } from '@lambda-event-router/base';
import type { S3ObjectRemovedRequest } from '@lambda-event-router/s3';

// A delete with no versionId on a versioned bucket hides the object behind a delete marker. The
// versionId on the record is the marker's, not the object's.
export async function recordDeleteMarker(request: S3ObjectRemovedRequest): Promise<void> {
  logger.info({
    message: 'Delete marker recorded',
    key: request.key,
    versionId: request.versionId,
  });
}
