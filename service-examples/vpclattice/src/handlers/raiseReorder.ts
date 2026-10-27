import { defineRoute } from '@latcher/vpclattice';

import { ReorderSchema } from '../utils/schemas.js';

// The supplier's ordering system is down, so this route always throws. The matcher answers 500 and
// keeps the error's message out of the body, because it can hold internal detail.
export const raiseReorder = defineRoute({
  filters: { method: 'POST', path: '/reorders' },
  bodySchema: ReorderSchema,
}).handle(async (request) => {
  throw new Error(`Supplier ordering is unavailable for ${request.body.sku}`);
});
