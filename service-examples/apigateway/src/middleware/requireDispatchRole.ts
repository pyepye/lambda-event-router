import { Forbidden, type HTTPMiddleware, Unauthorized } from '@latcher/apigateway';

import { DISPATCH_ROLE, STAFF_ROLE_HEADER } from '../utils/constants.js';

// Route middleware on POST /dispatch. A thrown response short-circuits the chain, so the handler
// never runs for a caller without the role.
export const requireDispatchRole: HTTPMiddleware = async (request, next) => {
  const role = request.headers[STAFF_ROLE_HEADER];

  if (!role) throw Unauthorized(`${STAFF_ROLE_HEADER} is required`);
  if (role !== DISPATCH_ROLE) throw Forbidden(`${role} cannot book a consignment`);

  return next(request);
};
