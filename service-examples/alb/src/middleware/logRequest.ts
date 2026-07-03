import type { HTTPMiddleware } from '@lambda-event-router/alb';
import { logger } from '@lambda-event-router/base';
import type { ALBEvent } from 'aws-lambda';

// Router middleware: runs for every matched route, before any route middleware. `eventForm` says
// which shape the load balancer sent, and only a multi-value target group fills `multiValueHeaders`.
export const logRequest: HTTPMiddleware = async (request, next) => {
  const event = request.event as ALBEvent;

  logger.info({
    message: 'Handling returns request',
    method: request.method,
    rawPath: request.rawPath,
    eventForm: event.multiValueHeaders ? 'multi-value' : 'single-value',
    targetGroupArn: request.auth?.targetGroupArn,
  });

  return next(request);
};
