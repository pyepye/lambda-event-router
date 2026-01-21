import type { S3ObjectRestoreRequest } from '@lambda-event-router/s3';

export async function objectRestorePost(request: S3ObjectRestoreRequest): Promise<void> {
  const { bucket, key, eventTime } = request;
  console.log(`Restore initiated: ${key} in ${bucket} at ${eventTime}`);
}

export async function objectRestoreCompleted(request: S3ObjectRestoreRequest): Promise<void> {
  const { bucket, key, eventTime, restoreEventData } = request;
  console.log(`Restore completed: ${key} in ${bucket} at ${eventTime}`);
  if (restoreEventData) {
    console.log(`Expiry: ${restoreEventData.lifecycleRestorationExpiryTime}`);
    console.log(`Storage class: ${restoreEventData.lifecycleRestoreStorageClass}`);
  }
}

export async function objectRestoreDelete(request: S3ObjectRestoreRequest): Promise<void> {
  const { bucket, key } = request;
  console.log(`Restored copy expired: ${key} in ${bucket}`);
}
