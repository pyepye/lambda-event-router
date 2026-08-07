import { defineConfigScheduledRoute } from '@lambda-event-router/config';

import { configRuleName } from '../environment.js';
import { reportAccountEvaluation } from '../utils/evaluations.js';
import { isEnabled } from '../utils/featureFlags.js';
import { IdleFunctionSweepParametersSchema } from '../utils/schemas.js';

// The sweep sits behind a feature flag, which the async custom filter reads. The rule is deployed with
// maxIdleDays `ninety`, which does not coerce to a number, so this handler never runs.
export const sweepIdleFunctions = defineConfigScheduledRoute({
  filters: {
    configRuleName: configRuleName('idleFunctionSweep'),
    custom: async () => isEnabled('idle-function-sweep'),
  },
  ruleParametersSchema: IdleFunctionSweepParametersSchema,
}).handle(async (request) => {
  await reportAccountEvaluation(
    request,
    'COMPLIANT',
    `No functions idle for more than ${request.ruleParameters.maxIdleDays} days`,
  );
});
