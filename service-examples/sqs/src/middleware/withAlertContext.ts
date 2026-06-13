import { logger } from '@lambda-event-router/base';
import type { SQSMiddleware } from '@lambda-event-router/sqs';

import type { TPriorityAlert } from '../utils/schemas.js';

// Route middleware for the priority queue: tags the log with the FIFO group, which is the tenant.
// Typed to the route's body so it slots onto deliverPriorityAlert without widening it.
export const withAlertContext: SQSMiddleware<TPriorityAlert> = async (request, next) => {
  logger.info({
    message: 'Priority alert received',
    tenantId: request.record.attributes.MessageGroupId,
  });
  await next(request);
};
