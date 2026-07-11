import { isObject, logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/codepipeline';

import { CANARY_STEP, FIRST_CANARY_TOKEN, SECOND_CANARY_TOKEN } from '../config.js';
import { DEPLOYER_FUNCTION_NAME } from '../environment.js';
import { CanaryParametersSchema } from '../utils/schemas.js';

// Registered with router.continuation(), which adds hasContinuationToken true to these filters. That
// is the whole difference between this route and startCanaryDeployment.
// Returning another token asks CodePipeline for one more round. Returning nothing ends the action.
export const awaitCanaryHealth = defineRoute({
  filters: {
    functionName: DEPLOYER_FUNCTION_NAME,
    custom: async ({ userParameters }) => isObject(userParameters) && userParameters.step === CANARY_STEP,
  },
  userParametersSchema: CanaryParametersSchema,
}).handle(async (request) => {
  if (request.continuationToken === FIRST_CANARY_TOKEN) {
    logger.info({
      message: 'Canary still warming up',
      jobId: request.jobId,
      continuationToken: request.continuationToken,
    });
    return { continuationToken: SECOND_CANARY_TOKEN };
  }

  logger.info({
    message: 'Canary healthy',
    jobId: request.jobId,
    continuationToken: request.continuationToken,
    bundleSha: request.userParameters.bundleSha,
  });

  return undefined;
});
