import { createSQSRouter } from '@lambda-event-router/sqs';

import { decrementStock } from './sqs-handlers/decrementStock.js';
import { sendConfirmationEmail } from './sqs-handlers/sendConfirmationEmail.js';
import { sqsTracingMiddleware } from './utils/traceId/sqsTracingMiddleware.js';

export const sqsRouter = createSQSRouter({
  batchItemFailures: true,
  middleware: [sqsTracingMiddleware],
});

sqsRouter.route(decrementStock).route(sendConfirmationEmail);
