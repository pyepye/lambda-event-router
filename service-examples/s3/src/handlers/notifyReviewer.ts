import type { S3ObjectCreatedRequest } from '@lambda-event-router/s3';

// The one route that fails inside the handler rather than on the way to it. Its record has a
// logRecord line, because the router middleware has already run by the time the handler throws.
export async function notifyReviewer(request: S3ObjectCreatedRequest): Promise<void> {
  throw new Error(`Review service unavailable for ${request.key}`);
}
