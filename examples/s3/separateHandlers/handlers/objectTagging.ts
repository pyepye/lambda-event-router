import type { S3ObjectTaggingRequest } from '@lambda-event-router/s3';

export async function objectTaggingPut(request: S3ObjectTaggingRequest): Promise<void> {
  const { bucket, key, eventTime } = request;
  console.log(`Tags added to object: ${key} in ${bucket} at ${eventTime}`);
}

export async function objectTaggingDelete(request: S3ObjectTaggingRequest): Promise<void> {
  const { bucket, key, eventTime } = request;
  console.log(`Tags removed from object: ${key} in ${bucket} at ${eventTime}`);
}
