import { defineRoute } from '@lambda-event-router/config';

import { configRuleName } from '../environment.js';
import { reportOversized, reportResourceEvaluation } from '../utils/evaluations.js';
import { MemoryConfigurationSchema, MemoryLimitParametersSchema } from '../utils/schemas.js';

// Claims every evaluation of the memory rule. grantMemoryExemption shares this rule name and adds a
// resourceId, so the router tries it first.
export const checkMemoryLimit = defineRoute({
  filters: {
    configRuleName: configRuleName('memoryLimit'),
  },
  ruleParametersSchema: MemoryLimitParametersSchema,
  configurationSchema: MemoryConfigurationSchema,
}).handle(async (request) => {
  if (!request.configurationItem) {
    await reportOversized(request);
    return;
  }

  const { memorySize } = request.configurationItem.configuration;
  const { maxMemoryMb } = request.ruleParameters;

  if (memorySize <= maxMemoryMb) {
    await reportResourceEvaluation(request, 'COMPLIANT', `${memorySize} MB is within the ${maxMemoryMb} MB limit`);
    return;
  }

  await reportResourceEvaluation(request, 'NON_COMPLIANT', `${memorySize} MB is over the ${maxMemoryMb} MB limit`);
});
