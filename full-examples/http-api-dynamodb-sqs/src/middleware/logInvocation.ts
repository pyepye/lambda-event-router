import type { HTTPMiddleware, LambdaAuthorizerMiddleware } from '@latcher/apigateway';
import { logger } from '@latcher/base';
import type { DynamoDBMiddleware } from '@latcher/dynamodb';
import type { SQSMiddleware } from '@latcher/sqs';

export const logApiInvocation: HTTPMiddleware = async (request, next) => {
  logger.info({ message: 'Handling API request', method: request.method, path: request.rawPath });
  return next(request);
};

export const logAuthorizerInvocation: LambdaAuthorizerMiddleware = async (request, next) => {
  logger.info({ message: 'Handling authorizer request', type: request.type });
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
