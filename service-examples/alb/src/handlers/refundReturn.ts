import { defineRoute } from '@lambda-event-router/alb';

import { RefundSchema } from '../utils/schemas.js';

// The payments provider is down, so this route always throws. The router answers 500 and keeps the
// error's message out of the body, because it can hold internal detail.
export const refundReturn = defineRoute({
  filters: { method: 'POST', path: '/refunds' },
  bodySchema: RefundSchema,
}).handle(async (request) => {
  throw new Error(`Refunds are unavailable for ${request.body.returnId}`);
});
