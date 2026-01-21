import type { S3ObjectRemovedRequest } from '@lambda-event-router/s3';

export async function objectRemoved(request: S3ObjectRemovedRequest): Promise<void> {
  const { bucket, key, eventName } = request;
  console.log(`Object removed: ${key} from ${bucket}`);
  console.log(`Event: ${eventName}`);
}

export async function objectRemovedDelete(request: S3ObjectRemovedRequest): Promise<void> {
  const { bucket, key } = request;
  console.log(`Object deleted: ${key} from ${bucket}`);
}

export async function objectRemovedDeleteMarkerCreated(request: S3ObjectRemovedRequest): Promise<void> {
  const { bucket, key, versionId } = request;
  console.log(`Delete marker created: ${key} in ${bucket}`);
  console.log(`Version ID: ${versionId}`);
}
