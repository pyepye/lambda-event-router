import type { S3BatchRequest, S3BatchResponse } from '@lambda-event-router/s3';
import { Succeeded } from '@lambda-event-router/s3';

export async function batchOperation(request: S3BatchRequest): Promise<S3BatchResponse> {
  const { taskId, bucket, key } = request;
  console.log(`Processing batch task ${taskId}: ${key} in ${bucket}`);

  return Succeeded(`Processed ${key}`);
}
