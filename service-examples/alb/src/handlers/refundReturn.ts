import { defineRoute } from '@lambda-event-router/alb';

import { RefundSchema } from '../utils/schemas.js';

// The payments provider is down, so this route always throws. An error the router does not
// recognise as a response is answered 500 with the error's message.
export const refundReturn = defineRoute({
  filters: { method: 'POST', path: '/refunds' },
  bodySchema: RefundSchema,
}).handle(async (request) => {
  throw new Error(`Refunds are unavailable for ${request.body.returnId}`);
});
