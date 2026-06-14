import { logger } from '@lambda-event-router/base';
import type { SNSMiddleware } from '@lambda-event-router/sns';

// Router middleware: runs for every record that reaches a handler, on every topic.
export const logDelivery: SNSMiddleware = async (request, next) => {
  logger.info({
    message: 'Handling SNS record',
    messageId: request.record.Sns.MessageId,
    topic: request.record.Sns.TopicArn,
    subject: request.record.Sns.Subject,
  });
  await next(request);
};
