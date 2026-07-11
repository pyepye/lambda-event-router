import { defineRoute } from '@lambda-event-router/codepipeline';

import { DEPLOYER_FUNCTION_NAME } from '../environment.js';

// Rollback is the only deployer action declared without input artifacts, which is what picks it out.
// It always throws, so this is the failure that comes from a handler rather than from routing or a
// schema. The distinction shows in the log: the router middleware has already run by the time the
// handler throws, so this job has a logJob line. A job that fails its schema has none.
export const rollbackRelease = defineRoute({
  filters: {
    functionName: DEPLOYER_FUNCTION_NAME,
    hasInputArtifacts: false,
  },
}).handle(async (request) => {
  throw new Error(`Rollback target unavailable for job ${request.jobId}`);
});
