import { logger } from '@latcher/base';
import type { HTTPMiddleware, VPCLatticeEvent } from '@latcher/vpclattice';

// Matcher middleware: runs for every matched route, before any route middleware. `payloadVersion`
// says which adapter normalised the event, and a 1.0 payload is the one with `raw_path`.
export const logRequest: HTTPMiddleware = async (request, next) => {
  const event = request.event as VPCLatticeEvent;

  logger.info({
    message: 'Handling inventory request',
    method: request.method,
    rawPath: request.rawPath,
    payloadVersion: 'raw_path' in event ? '1.0' : '2.0',
  });

  return next(request);
};
