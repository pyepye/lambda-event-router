import { defineRoute } from '@latcher/config';

import { configRuleName, REPORT_BUILDER_FUNCTION_NAME } from '../environment.js';
import { reportResourceEvaluation } from '../utils/evaluations.js';

// report-builder has an approved exemption from the memory limit. Registered after checkMemoryLimit,
// but the matcher ranks it first because its filters are narrower.
export const grantMemoryExemption = defineRoute({
  filters: {
    configRuleName: configRuleName('memoryLimit'),
    resourceId: REPORT_BUILDER_FUNCTION_NAME,
  },
}).handle(async (request) => {
  await reportResourceEvaluation(request, 'NOT_APPLICABLE', 'Exempt from the memory limit until 2027-03-31');
});
