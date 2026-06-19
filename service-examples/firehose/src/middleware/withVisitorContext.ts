import { logger } from '@lambda-event-router/base';
import type { FirehoseMiddleware } from '@lambda-event-router/firehose';

import type { TSignUp } from '../utils/schemas.js';

// Route middleware for the sign up route. Typed to the route's data, so it reads the plan without
// widening the route.
export const withVisitorContext: FirehoseMiddleware<TSignUp> = async (request, next) => {
  logger.info({
    message: 'Sign up received',
    visitorId: request.data.visitorId,
    plan: request.data.plan,
  });

  return next(request);
};
