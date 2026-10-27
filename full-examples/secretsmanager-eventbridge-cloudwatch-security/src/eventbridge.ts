import { createEventBridgeMatcher } from '@latcher/eventbridge';

import { checkRotationAge } from './eventbridge-handlers/checkRotationAge.js';
import { logEventBridgeInvocation } from './middleware/logInvocation.js';

export const eventBridgeMatcher = createEventBridgeMatcher({
  middleware: [logEventBridgeInvocation],
});

eventBridgeMatcher.route(checkRotationAge);
