import { logger } from '@lambda-event-router/base';
import type { DynamoDBMiddleware } from '@lambda-event-router/dynamodb';

import type { TOrder } from '../utils/schemas.js';

// Route middleware for the orders stream: tags later log lines in this invocation with the order id.
// LambdaRouter clears appended keys once per invocation, not once per record, so the id stays on every
// record that follows in the same batch.
// Typed to the route's new image so it slots onto processOrder without widening it. `newImage` is
// optional here because the middleware type spans all three event names, and a REMOVE has none.
export const withOrderContext: DynamoDBMiddleware<Record<string, unknown>, TOrder> = async (request, next) => {
  logger.appendKeys({ orderId: request.newImage?.orderId });
  await next(request);
};
