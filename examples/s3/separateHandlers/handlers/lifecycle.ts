import type { S3LifecycleExpirationRequest, S3LifecycleTransitionRequest } from '@lambda-event-router/s3';

export async function lifecycleExpirationDelete(request: S3LifecycleExpirationRequest): Promise<void> {
  const { bucket, key, eventTime } = request;
  console.log(`Lifecycle expiration delete: ${key} in ${bucket} at ${eventTime}`);
}

export async function lifecycleExpirationDeleteMarkerCreated(request: S3LifecycleExpirationRequest): Promise<void> {
  const { bucket, key, versionId } = request;
  console.log(`Lifecycle delete marker created: ${key} in ${bucket}`);
  console.log(`Version ID: ${versionId}`);
}

export async function lifecycleTransition(request: S3LifecycleTransitionRequest): Promise<void> {
  const { bucket, key, eventTime } = request;
  console.log(`Lifecycle transition: ${key} in ${bucket} at ${eventTime}`);
}
