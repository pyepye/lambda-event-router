import type { S3FilterInput, S3ObjectCreatedRequest } from '@lambda-event-router/s3';

const LARGE_FILE_THRESHOLD_BYTES = 100 * 1024 * 1024;

export function isLargeFile({ record }: S3FilterInput): boolean {
  return record.s3.object.size >= LARGE_FILE_THRESHOLD_BYTES;
}

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
