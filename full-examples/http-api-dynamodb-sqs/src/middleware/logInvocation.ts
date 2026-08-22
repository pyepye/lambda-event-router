import type { HTTPMiddleware } from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';
import type { DynamoDBMiddleware } from '@lambda-event-router/dynamodb';
import type { SQSMiddleware } from '@lambda-event-router/sqs';

export const logApiInvocation: HTTPMiddleware = async (request, next) => {
  logger.info({ message: 'Handling API request', method: request.method, path: request.rawPath });
  return next(request);
};

export const logStreamInvocation: DynamoDBMiddleware = async (request, next) => {
  logger.info({ message: 'Handling DynamoDB record', eventName: request.eventName, keys: request.keys });
  await next(request);
};

export const logSqsInvocation: SQSMiddleware = async (request, next) => {
  logger.info({
    message: 'Handling SQS record',
    messageId: request.record.messageId,
    type: request.messageAttributes.type,
  });
  await next(request);
};
