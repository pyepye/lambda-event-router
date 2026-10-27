import type { ALBEvent } from 'aws-lambda';

import type { HTTPMiddleware } from '@latcher/alb';
import { logger } from '@latcher/base';

// Matcher middleware: runs for every matched route, before any route middleware. `eventForm` says
// which shape the load balancer sent, and only a multi-value target group fills `multiValueHeaders`.
export const logRequest: HTTPMiddleware = async (request, next) => {
  const event = request.event as ALBEvent;

  logger.info({
    message: 'Handling returns request',
    method: request.method,
    rawPath: request.rawPath,
    eventForm: event.multiValueHeaders ? 'multi-value' : 'single-value',
    targetGroupArn: event.requestContext.elb.targetGroupArn,
  });

  return next(request);
};
