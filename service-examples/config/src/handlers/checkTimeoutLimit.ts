import { defineRoute } from '@latcher/config';

import { configRuleName } from '../environment.js';
import { reportOversized, reportResourceEvaluation } from '../utils/evaluations.js';
import { TimeoutConfigurationSchema, TimeoutLimitParametersSchema } from '../utils/schemas.js';

// The timeout rule is deployed with maxTimeoutSeconds `15m`, which does not coerce to a number. Every
// evaluation fails its ruleParameters schema, so this handler never runs.
export const checkTimeoutLimit = defineRoute({
  filters: {
    configRuleName: configRuleName('timeoutLimit'),
  },
  ruleParametersSchema: TimeoutLimitParametersSchema,
  configurationSchema: TimeoutConfigurationSchema,
}).handle(async (request) => {
  if (!request.configurationItem) {
    await reportOversized(request);
    return;
  }

  const { timeout } = request.configurationItem.configuration;
  const { maxTimeoutSeconds } = request.ruleParameters;
  const complianceType = timeout <= maxTimeoutSeconds ? 'COMPLIANT' : 'NON_COMPLIANT';

  await reportResourceEvaluation(request, complianceType, `Timeout is ${timeout}s, limit is ${maxTimeoutSeconds}s`);
});
