import { defineRoute } from '@lambda-event-router/config';

import { configRuleName } from '../environment.js';
import { reportOversized, reportResourceEvaluation } from '../utils/evaluations.js';
import { CatalogueConfigurationSchema } from '../utils/schemas.js';
import { serviceCatalogue } from '../utils/serviceCatalogue.js';

// A decommissioned function stays out of the catalogue. A string filter cannot say "not in this
// list", so the async custom filter asks the catalogue instead.
export const registerInCatalogue = defineRoute({
  filters: {
    configRuleName: configRuleName('serviceCatalogue'),
    custom: async ({ resourceId }) =>
      resourceId !== undefined && !(await serviceCatalogue.isDecommissioned(resourceId)),
  },
  configurationSchema: CatalogueConfigurationSchema,
}).handle(async (request) => {
  if (!request.configurationItem) {
    await reportOversized(request);
    return;
  }

  const { functionName, description } = request.configurationItem.configuration;
  await serviceCatalogue.register(functionName, description);
  await reportResourceEvaluation(request, 'COMPLIANT', 'Registered in the service catalogue');
});
