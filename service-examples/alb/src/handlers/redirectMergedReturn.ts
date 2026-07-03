import { defineRoute, NotFound, PermanentRedirect, TemporaryRedirect } from '@lambda-event-router/alb';
import { logger } from '@lambda-event-router/base';

import { MERGED_RETURNS, RETURNS_UNDER_REVIEW } from '../utils/returns.js';

// A return merged into another one moves for good, so it answers 308. One still under review may
// come back, so it answers 307 and points at the open list instead.
export const redirectMergedReturn = defineRoute({
  filters: { method: 'GET', path: '/returns/merged/:returnId' },
}).handle(async (request) => {
  const { returnId } = request.path;
  const successor = MERGED_RETURNS[returnId];

  if (successor) {
    logger.info({ message: 'Merged return redirected', returnId, successor });
    return PermanentRedirect(`/returns/${successor}`);
  }

  if (RETURNS_UNDER_REVIEW.includes(returnId)) {
    logger.info({ message: 'Return under review redirected', returnId });
    return TemporaryRedirect('/returns/open');
  }

  throw NotFound({ error: `Return ${returnId} has not been merged` });
});
