import { logger } from '@latcher/base';
import type { DynamoDBMiddleware } from '@latcher/dynamodb';

// Matcher middleware: runs once per record, before any route middleware, for both streams.
export const logChange: DynamoDBMiddleware = async (request, next) => {
  logger.info({
    message: 'Handling DynamoDB record',
    eventID: request.record.eventID,
    eventName: request.eventName,
    stream: request.record.eventSourceARN,
  });
  await next(request);
};
