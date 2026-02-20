import { defineRoute } from '@lambda-event-router/codepipeline';
import { z } from 'zod';

import { FUNCTION_NAME } from '../constants.js';

const DeployParametersSchema = z.object({
  environment: z.string(),
  region: z.string(),
  stackName: z.string(),
});

// userParameters is parsed from JSON and validated against the schema by the router.
// Return outputVariables to pass data to subsequent pipeline actions.
// The router calls putJobSuccessResult with the outputVariables map.
export const deployActionRoute = defineRoute({
  filters: {
    functionNames: [FUNCTION_NAME],
  },
  userParametersSchema: DeployParametersSchema,
}).handle(async ({ jobId, userParameters }) => {
  const { environment, region, stackName } = userParameters;
  console.log(`Deploying job ${jobId}: stack ${stackName} to ${environment} in ${region}`);

  return {
    outputVariables: {
      deployedEnvironment: environment,
      deployedRegion: region,
    },
  };
});
