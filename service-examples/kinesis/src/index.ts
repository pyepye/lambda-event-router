import { type LambdaMiddleware, LambdaRouter, logger } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { kinesisRouter } from './kinesis.js';

// The router returns the batch response to Lambda rather than to a caller, so log it. The sequence
// numbers it names are the ones Lambda retries from.
const logBatchResponse: LambdaMiddleware = async (event, context, next) => {
  const response = await next(event, context);
  logger.info({ message: 'Batch response returned', response });
  return response;
};

const lambdaRouter = new LambdaRouter({ routers: [kinesisRouter], middleware: [logBatchResponse] });

export const handler: Handler = lambdaRouter.handler();
