import { defineRoute } from '@lambda-event-router/vpclattice';

import { ReorderSchema } from '../utils/schemas.js';

// The supplier's ordering system is down, so this route always throws. An error the router does
// not recognise as a response is answered 500 with the error's message.
export const raiseReorder = defineRoute({
  filters: { method: 'POST', path: '/reorders' },
  bodySchema: ReorderSchema,
}).handle(async (request) => {
  throw new Error(`Supplier ordering is unavailable for ${request.body.sku}`);
});
