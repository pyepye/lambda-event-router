import { logger } from '@lambda-event-router/base';
import type { S3Middleware } from '@lambda-event-router/s3';

// Router middleware: runs once per record, before any route middleware, for every bucket.
export const logRecord: S3Middleware = async (request, next) => {
  logger.info({
    message: 'Handling S3 record',
    bucket: request.bucket,
    key: request.key,
    eventName: request.eventName,
    versionId: request.versionId,
  });
  await next(request);
};
