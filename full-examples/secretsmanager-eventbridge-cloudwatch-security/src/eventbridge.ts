import { createEventBridgeRouter } from '@lambda-event-router/eventbridge';

import { checkRotationAge } from './eventbridge-handlers/checkRotationAge.js';
import { logEventBridgeInvocation } from './middleware/logInvocation.js';

export const eventBridgeRouter = createEventBridgeRouter({
  middleware: [logEventBridgeInvocation],
});

eventBridgeRouter.route(checkRotationAge);
