import { logger } from '@lambda-event-router/base';
import type { S3Middleware } from '@lambda-event-router/s3';

// Route middleware for scanDocument: names the file the scanner is about to open.
export const withDocumentContext: S3Middleware = async (request, next) => {
  logger.info({
    message: 'Document queued for scanning',
    fileName: request.key.split('/').at(-1),
  });
  await next(request);
};
