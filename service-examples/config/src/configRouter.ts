import { createConfigRouter } from '@lambda-event-router/config';

import { checkMemoryLimit } from './handlers/checkMemoryLimit.js';
import { checkOnCallRota } from './handlers/checkOnCallRota.js';
import { checkRuntime } from './handlers/checkRuntime.js';
import { checkTimeoutLimit } from './handlers/checkTimeoutLimit.js';
import { grantMemoryExemption } from './handlers/grantMemoryExemption.js';
import { registerInCatalogue } from './handlers/registerInCatalogue.js';
import { logEvaluation } from './middleware/logEvaluation.js';

export const configRouter = createConfigRouter({
  middleware: [logEvaluation],
});

// The confidential-tracing rule has no route, so its evaluations match nothing.
configRouter
  .route(checkRuntime)
  .route(checkMemoryLimit)
  .route(grantMemoryExemption)
  .route(registerInCatalogue)
  .route(checkTimeoutLimit)
  .route(checkOnCallRota);
