import { Conflict, type HTTPMiddleware } from '@lambda-event-router/alb';
import { logger } from '@lambda-event-router/base';

import { DESK_CLOSED, DESK_STATE_HEADER } from '../utils/constants.js';

// Route middleware on PUT /returns/:returnId/note. A closed desk answers without the handler
// running, which is the other way a middleware can end a request.
export const withDeskClosure: HTTPMiddleware<
  { returnId: string },
  Record<string, string | undefined>,
  unknown
> = async (request, next) => {
  if (request.headers[DESK_STATE_HEADER] === DESK_CLOSED) {
    logger.info({ message: 'Return note refused, the desk is closed', returnId: request.path.returnId });
    return Conflict({ error: `The returns desk is closed for ${request.path.returnId}` });
  }

  return next(request);
};
