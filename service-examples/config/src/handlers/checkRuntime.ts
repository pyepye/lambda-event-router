import { defineRoute } from '@latcher/config';

import { configRuleName } from '../environment.js';
import { reportOversized, reportResourceEvaluation } from '../utils/evaluations.js';
import { ApprovedRuntimeParametersSchema, RuntimeConfigurationSchema } from '../utils/schemas.js';

// The status filter keeps deleted and unrecorded resources off this route. Their configuration item
// carries no runtime to check.
export const checkRuntime = defineRoute({
  filters: {
    configRuleName: configRuleName('approvedRuntime'),
    resourceType: 'AWS::Lambda::Function',
    configurationItemStatus: ['OK', 'ResourceDiscovered'],
  },
  ruleParametersSchema: ApprovedRuntimeParametersSchema,
  configurationSchema: RuntimeConfigurationSchema,
}).handle(async (request) => {
  if (!request.configurationItem) {
    await reportOversized(request);
    return;
  }

  const { runtime } = request.configurationItem.configuration;
  const { allowedRuntimes } = request.ruleParameters;

  if (allowedRuntimes.includes(runtime)) {
    await reportResourceEvaluation(request, 'COMPLIANT', `${runtime} is approved`);
    return;
  }

  await reportResourceEvaluation(request, 'NON_COMPLIANT', `${runtime} is not one of ${allowedRuntimes.join(', ')}`);
});
