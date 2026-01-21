import type { S3BatchRequest, S3BatchResult } from '@lambda-event-router/s3';

export async function batchOperation(request: S3BatchRequest): Promise<S3BatchResult> {
  const { taskId, bucket, key, event } = request;
  console.log(`Processing batch task ${taskId}: ${key} in ${bucket}`);

  return {
    invocationSchemaVersion: event.invocationSchemaVersion,
    treatMissingKeysAs: 'PermanentFailure',
    invocationId: event.invocationId,
    results: [
      {
        taskId,
        resultCode: 'Succeeded',
        resultString: `Processed ${key}`,
      },
    ],
  };
}
