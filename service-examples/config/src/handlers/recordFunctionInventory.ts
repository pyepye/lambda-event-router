import { ListDiscoveredResourcesCommand } from '@aws-sdk/client-config-service';
import { defineConfigScheduledRoute } from '@lambda-event-router/config';

import { ACCOUNT_ID, configRuleName, configServiceClient } from '../environment.js';
import { withAccountContext } from '../middleware/withAccountContext.js';
import { reportAccountEvaluation } from '../utils/evaluations.js';
import { LambdaInventoryParametersSchema } from '../utils/schemas.js';

// Counts the Lambda functions the recorder has discovered in this region. One page holds up to 100,
// which is enough for this account.
export const recordFunctionInventory = defineConfigScheduledRoute({
  filters: {
    configRuleName: configRuleName('lambdaInventory'),
    accountId: ACCOUNT_ID,
  },
  ruleParametersSchema: LambdaInventoryParametersSchema,
  middleware: [withAccountContext],
}).handle(async (request) => {
  const { resourceIdentifiers = [] } = await configServiceClient.send(
    new ListDiscoveredResourcesCommand({ resourceType: 'AWS::Lambda::Function' }),
  );

  const count = resourceIdentifiers.length;
  const { maxFunctions } = request.ruleParameters;
  const complianceType = count <= maxFunctions ? 'COMPLIANT' : 'NON_COMPLIANT';

  await reportAccountEvaluation(
    request,
    complianceType,
    `${count} of at most ${maxFunctions} Lambda functions recorded`,
  );
});
