import { logger } from '@lambda-event-router/base';
import type { SQSMiddleware } from '@lambda-event-router/sqs';

// Router middleware: runs once per record, before any route middleware, for every queue.
export const logInvocation: SQSMiddleware = async (request, next) => {
  logger.info({
    message: 'Handling SQS record',
    messageId: request.record.messageId,
    queue: request.record.eventSourceARN,
  });
  await next(request);
};
