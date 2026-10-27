import { createConfigMatcher } from '@latcher/config';

import { checkMemoryLimit } from './handlers/checkMemoryLimit.js';
import { checkOnCallRota } from './handlers/checkOnCallRota.js';
import { checkRuntime } from './handlers/checkRuntime.js';
import { checkTimeoutLimit } from './handlers/checkTimeoutLimit.js';
import { grantMemoryExemption } from './handlers/grantMemoryExemption.js';
import { registerInCatalogue } from './handlers/registerInCatalogue.js';
import { logEvaluation } from './middleware/logEvaluation.js';

export const configMatcher = createConfigMatcher({
  middleware: [logEvaluation],
});

// The confidential-tracing rule has no route, so its evaluations match nothing.
configMatcher
  .route(checkRuntime)
  .route(checkMemoryLimit)
  .route(grantMemoryExemption)
  .route(registerInCatalogue)
  .route(checkTimeoutLimit)
  .route(checkOnCallRota);
