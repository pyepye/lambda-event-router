import { createSQSRouter } from '@lambda-event-router/sqs';

import { deliverPriorityAlert } from './handlers/deliverPriorityAlert.js';
import { failDelivery } from './handlers/failDelivery.js';
import { holdMarketing } from './handlers/holdMarketing.js';
import { sendEmail } from './handlers/sendEmail.js';
import { logInvocation } from './middleware/logInvocation.js';

export const sqsRouter = createSQSRouter({
  batchItemFailures: true,
  middleware: [logInvocation],
});

// Order matters: holdMarketing's body filter must win over sendEmail's channel filter for a
// marketing message, so it is registered first.
sqsRouter.route(holdMarketing).route(sendEmail).route(failDelivery).route(deliverPriorityAlert);
