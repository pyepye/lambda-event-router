import { isObject, logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/codepipeline';

import { CANARY_STEP, FIRST_CANARY_TOKEN } from '../config.js';
import { DEPLOYER_FUNCTION_NAME } from '../environment.js';
import { CanaryParametersSchema } from '../utils/schemas.js';

// The first invocation of the canary action. hasContinuationToken false keeps it off the re-invokes,
// which awaitCanaryHealth takes instead. Its custom filter is async, which the router awaits.
// The token it returns is what CodePipeline sends back on the next invocation.
export const startCanaryDeployment = defineRoute({
  filters: {
    functionName: DEPLOYER_FUNCTION_NAME,
    hasContinuationToken: false,
    custom: async ({ userParameters }) => isObject(userParameters) && userParameters.step === CANARY_STEP,
  },
  userParametersSchema: CanaryParametersSchema,
}).handle(async (request) => {
  logger.info({
    message: 'Canary deployment started',
    jobId: request.jobId,
    environment: request.userParameters.environment,
    bundleSha: request.userParameters.bundleSha,
  });

  return { continuationToken: FIRST_CANARY_TOKEN };
});
