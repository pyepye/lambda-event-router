import type { S3ObjectAclRequest } from '@lambda-event-router/s3';

export async function objectAclPut(request: S3ObjectAclRequest): Promise<void> {
  const { bucket, key, eventTime } = request;
  console.log(`ACL updated for object: ${key} in ${bucket} at ${eventTime}`);
}
