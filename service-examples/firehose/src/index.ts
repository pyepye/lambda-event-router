import { type LambdaMiddleware, LambdaRouter, logger } from '@lambda-event-router/base';
import type { FirehoseTransformationResult, Handler } from 'aws-lambda';

import { firehoseRouter } from './firehose.js';

function isTransformationResult(value: unknown): value is FirehoseTransformationResult {
  return typeof value === 'object' && value !== null && Array.isArray((value as { records?: unknown }).records);
}

// The router hands its results to Firehose rather than to a caller, so log them. This line is where
// the Ok, Dropped and ProcessingFailed decisions for one invocation can be counted. The record data
// is left out, because it is the whole payload again in base64.
const logTransformationResult: LambdaMiddleware = async (event, context, next) => {
  const response = await next(event, context);

  if (isTransformationResult(response)) {
    logger.info({
      message: 'Transformation result returned',
      results: response.records.map(({ recordId, result }) => ({ recordId, result })),
    });
  }

  return response;
};

const lambdaRouter = new LambdaRouter({ routers: [firehoseRouter], middleware: [logTransformationResult] });

export const handler: Handler = lambdaRouter.handler();
