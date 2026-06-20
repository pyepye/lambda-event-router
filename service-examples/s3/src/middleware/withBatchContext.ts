import { logger } from '@lambda-event-router/base';
import type { S3BatchMiddleware } from '@lambda-event-router/s3';

// Batch middleware: a different request and response type from the notification middleware, so a
// batch route takes its own chain. It returns the handler's response untouched.
export const withBatchContext: S3BatchMiddleware = async (request, next) => {
  logger.info({
    message: 'Handling batch task',
    taskId: request.taskId,
    jobId: request.event.job.id,
    key: request.key,
  });
  return next(request);
};
