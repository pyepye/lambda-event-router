import { logger } from '@lambda-event-router/base';
import type { SNSMessageAttributes, SNSMiddleware } from '@lambda-event-router/sns';

import type { TOrder, TOrderAttributes } from '../utils/schemas.js';

// Route middleware for the orders topic: tags every later log line in this invocation with the order
// id. LambdaRouter clears the keys at the start of each invocation, so they never leak between orders.
// Typed to the route's body and attributes so it slots onto processOrder without widening it. Both type
// arguments are needed even though only the body is read, because the `next` callback makes the
// middleware type invariant in the request.
export const withOrderContext: SNSMiddleware<TOrder, TOrderAttributes & SNSMessageAttributes> = async (
  request,
  next,
) => {
  logger.appendKeys({ orderId: request.body.orderId });
  await next(request);
};
