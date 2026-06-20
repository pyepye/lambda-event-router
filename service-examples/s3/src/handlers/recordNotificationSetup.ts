import { logger } from '@lambda-event-router/base';
import type { S3TestEventRequest } from '@lambda-event-router/s3';

// s3:TestEvent has no Records, so it takes testEvent() rather than a normal route. Without this
// route the router still claims the event and returns, so the invocation succeeds either way.
export async function recordNotificationSetup(request: S3TestEventRequest): Promise<void> {
  logger.info({
    message: 'Bucket notifications live',
    bucket: request.bucket,
    time: request.time,
  });
}
