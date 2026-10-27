import type { Handler } from 'aws-lambda';

import { type LambdaMiddleware, Latcher, logger } from '@latcher/base';

import { kinesisMatcher } from './kinesis.js';

// The matcher returns the batch response to Lambda rather than to a caller, so log it. The sequence
// numbers it names are the ones Lambda retries from.
const logBatchResponse: LambdaMiddleware = async (event, context, next) => {
  const response = await next(event, context);
  logger.info({ message: 'Batch response returned', response });
  return response;
};

const latcher = new Latcher({ matchers: [kinesisMatcher], middleware: [logBatchResponse] });

export const handler: Handler = latcher.handler();
