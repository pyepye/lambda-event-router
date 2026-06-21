import { logger } from '@lambda-event-router/base';
import type { CognitoMiddleware } from '@lambda-event-router/cognito';

import type { TStaffAttributes } from '../utils/schemas.js';

// Route middleware for senior staff sign-ups. Typed to the route's validated attributes, so it reads
// the staff number without widening the route.
export const withDepartment: CognitoMiddleware<TStaffAttributes> = async (request, next) => {
  logger.info({
    message: 'Staff sign-up received',
    department: request.userAttributes['custom:department'],
    staffNumber: request.userAttributes['custom:staffNumber'],
  });
  return next(request);
};
