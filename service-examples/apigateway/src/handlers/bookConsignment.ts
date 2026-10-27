import { defineRoute } from '@latcher/apigateway';

import { requireDispatchRole } from '../middleware/requireDispatchRole.js';
import { ConsignmentBookingSchema } from '../utils/schemas.js';

// The carrier refuses every booking, so this route always throws. The matcher answers 500 and keeps
// the error's message out of the body, because it can hold internal detail.
export const bookConsignment = defineRoute({
  filters: { method: 'POST', path: '/dispatch' },
  bodySchema: ConsignmentBookingSchema,
  middleware: [requireDispatchRole],
}).handle(async (request) => {
  throw new Error(`Carrier ${request.body.carrier} rejected the booking`);
});
