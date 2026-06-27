import { Forbidden, type HTTPMiddleware, Unauthorised } from '@lambda-event-router/apigateway';

import { DISPATCH_ROLE, STAFF_ROLE_HEADER } from '../utils/constants.js';

// Route middleware on POST /dispatch. A thrown response short-circuits the chain, so the handler
// never runs for a caller without the role.
export const requireDispatchRole: HTTPMiddleware = async (request, next) => {
  const role = request.headers[STAFF_ROLE_HEADER];

  if (!role) throw Unauthorised({ error: `${STAFF_ROLE_HEADER} is required` });
  if (role !== DISPATCH_ROLE) throw Forbidden({ error: `${role} cannot book a consignment` });

  return next(request);
};
