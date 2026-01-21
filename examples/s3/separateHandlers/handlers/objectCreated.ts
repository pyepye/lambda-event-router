import type { S3ObjectCreatedRequest } from '@lambda-event-router/s3';

export async function objectCreated(request: S3ObjectCreatedRequest): Promise<void> {
  const { bucket, key, objectSize, eventName } = request;
  console.log(`Object created: ${key} in ${bucket}`);
  console.log(`Event: ${eventName}, Size: ${objectSize} bytes`);
}

export async function objectCreatedPut(request: S3ObjectCreatedRequest): Promise<void> {
  const { bucket, key, objectSize } = request;
  console.log(`Object put: ${key} in ${bucket} (${objectSize} bytes)`);
}

export async function objectCreatedPost(request: S3ObjectCreatedRequest): Promise<void> {
  const { bucket, key, objectSize } = request;
  console.log(`Object posted: ${key} in ${bucket} (${objectSize} bytes)`);
}

export async function objectCreatedCopy(request: S3ObjectCreatedRequest): Promise<void> {
  const { bucket, key, objectSize } = request;
  console.log(`Object copied: ${key} in ${bucket} (${objectSize} bytes)`);
}

export async function objectCreatedCompleteMultipartUpload(request: S3ObjectCreatedRequest): Promise<void> {
  const { bucket, key, objectSize } = request;
  console.log(`Multipart upload completed: ${key} in ${bucket} (${objectSize} bytes)`);
}

export async function objectCreatedThumbnail(request: S3ObjectCreatedRequest): Promise<void> {
  const { bucket, key, objectSize } = request;
  console.log(`Thumbnail created: ${key} in ${bucket} (${objectSize} bytes)`);
}
