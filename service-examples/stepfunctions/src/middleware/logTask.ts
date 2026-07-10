import { isObject, logger } from '@lambda-event-router/base';
import type { StepFunctionsMiddleware } from '@lambda-event-router/stepfunctions';

// Router middleware: runs once per invocation, before any route middleware, for every route.
export const logTask: StepFunctionsMiddleware = async (request, next) => {
  logger.info({
    message: 'Handling Step Functions task',
    task: isObject(request.event) ? request.event.task : undefined,
    requestId: request.context.awsRequestId,
  });
  return next(request);
};
