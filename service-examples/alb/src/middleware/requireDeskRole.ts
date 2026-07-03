import { Forbidden, type HTTPMiddleware, Unauthorised } from '@lambda-event-router/alb';
import { logger } from '@lambda-event-router/base';

import { DESK_ROLE_HEADER, RETURNS_DESK_ROLE } from '../utils/constants.js';

// Route middleware on GET /carriers/:carrierId/returns. ALB puts no identity on the event, so a
// caller's role is whatever header it sends. No header at all is a caller the desk cannot place,
// and the wrong one is a caller it can place and will not serve.
export const requireDeskRole: HTTPMiddleware<
  { carrierId: string },
  Record<string, string | undefined>,
  unknown
> = async (request, next) => {
  const role = request.headers[DESK_ROLE_HEADER];

  if (role === undefined) {
    logger.warn({ message: 'Carrier read refused, no desk role', carrierId: request.path.carrierId });
    throw Unauthorised({ error: 'The caller has no desk role' });
  }

  if (role !== RETURNS_DESK_ROLE) {
    logger.warn({ message: 'Carrier read refused, wrong desk role', carrierId: request.path.carrierId, role });
    throw Forbidden({ error: 'The caller is not on the returns desk' });
  }

  logger.info({ message: 'Carrier read authorised', carrierId: request.path.carrierId });

  return next(request);
};
