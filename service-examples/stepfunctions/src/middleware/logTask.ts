import { isObject, logger } from '@latcher/base';
import type { StepFunctionsMiddleware } from '@latcher/stepfunctions';

// Matcher middleware: runs once per invocation, before any route middleware, for every route.
export const logTask: StepFunctionsMiddleware = async (request, next) => {
  logger.info({
    message: 'Handling Step Functions task',
    task: isObject(request.event) ? request.event.task : undefined,
    requestId: request.context.awsRequestId,
  });
  return next(request);
};
