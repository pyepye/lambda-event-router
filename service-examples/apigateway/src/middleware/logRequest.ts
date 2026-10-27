import type { HTTPMiddleware } from '@latcher/apigateway';
import { logger } from '@latcher/base';

// Matcher middleware: runs for every matched route on all three APIs, before any route middleware.
// `payloadVersion` is the field that says which adapter normalised the event.
export const logRequest: HTTPMiddleware = async (request, next) => {
  const event = request.event as { version?: string; rawPath?: string };

  logger.info({
    message: 'Handling API request',
    method: request.method,
    rawPath: request.rawPath,
    payloadVersion: event.rawPath ? '2.0' : (event.version ?? 'rest'),
  });

  return next(request);
};
