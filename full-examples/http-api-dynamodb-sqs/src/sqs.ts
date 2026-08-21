import { createSQSRouter } from '@lambda-event-router/sqs';

import { logSqsInvocation } from './middleware/logInvocation.js';
import { decrementStock } from './sqs-handlers/decrementStock.js';
import { sendConfirmationEmail } from './sqs-handlers/sendConfirmationEmail.js';

export const sqsRouter = createSQSRouter({
  batchItemFailures: true,
  middleware: [logSqsInvocation],
});

sqsRouter.route(decrementStock).route(sendConfirmationEmail);
