import { logger } from '@latcher/base';
import type { SNSMiddleware } from '@latcher/sns';

// Matcher middleware: runs for every record that reaches a handler, on every topic.
export const logDelivery: SNSMiddleware = async (request, next) => {
  logger.info({
    message: 'Handling SNS record',
    messageId: request.record.Sns.MessageId,
    topic: request.record.Sns.TopicArn,
    subject: request.record.Sns.Subject,
  });
  await next(request);
};
