import { createSQSMatcher } from '@latcher/sqs';

import { logSqsInvocation } from './middleware/logInvocation.js';
import { decrementStock } from './sqs-handlers/decrementStock.js';
import { sendConfirmationEmail } from './sqs-handlers/sendConfirmationEmail.js';

export const sqsMatcher = createSQSMatcher({
  batchItemFailures: true,
  middleware: [logSqsInvocation],
});

sqsMatcher.route(decrementStock).route(sendConfirmationEmail);
