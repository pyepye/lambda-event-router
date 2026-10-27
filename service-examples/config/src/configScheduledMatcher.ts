import { createConfigScheduledMatcher } from '@latcher/config';

import { checkConcurrencyHeadroom } from './handlers/checkConcurrencyHeadroom.js';
import { recordFunctionInventory } from './handlers/recordFunctionInventory.js';
import { sweepIdleFunctions } from './handlers/sweepIdleFunctions.js';
import { logScheduledRun } from './middleware/logScheduledRun.js';

export const configScheduledMatcher = createConfigScheduledMatcher({
  middleware: [logScheduledRun],
});

// The cost-report rule has no route, so its evaluations match nothing.
configScheduledMatcher.route(recordFunctionInventory).route(sweepIdleFunctions).route(checkConcurrencyHeadroom);
