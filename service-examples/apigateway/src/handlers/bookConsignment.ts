import { defineRoute } from '@lambda-event-router/apigateway';

import { requireDispatchRole } from '../middleware/requireDispatchRole.js';
import { ConsignmentBookingSchema } from '../utils/schemas.js';

// The carrier refuses every booking, so this route always throws. An error the router does not
// recognise as a response is answered 500 with the error's message.
export const bookConsignment = defineRoute({
  filters: { method: 'POST', path: '/dispatch' },
  bodySchema: ConsignmentBookingSchema,
  middleware: [requireDispatchRole],
}).handle(async (request) => {
  throw new Error(`Carrier ${request.body.carrier} rejected the booking`);
});
