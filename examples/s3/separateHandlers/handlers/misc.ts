import type {
  S3IntelligentTieringRequest,
  S3ReducedRedundancyLostObjectRequest,
  S3TestEventRequest,
} from '@lambda-event-router/s3';

export async function reducedRedundancyLostObject(request: S3ReducedRedundancyLostObjectRequest): Promise<void> {
  const { bucket, key, eventTime } = request;
  console.log(`Reduced redundancy object lost: ${key} in ${bucket} at ${eventTime}`);
}

export async function intelligentTiering(request: S3IntelligentTieringRequest): Promise<void> {
  const { bucket, key, eventTime } = request;
  console.log(`Intelligent tiering event: ${key} in ${bucket} at ${eventTime}`);
}

export async function testEvent(request: S3TestEventRequest): Promise<void> {
  const { bucket, key, eventTime } = request;
  console.log(`Test event received: ${key} in ${bucket} at ${eventTime}`);
}
