import { defineRoute } from '@lambda-event-router/codepipeline';

import { FUNCTION_NAME } from '../constants.js';

// Return a continuationToken to signal the job is still in progress.
// The router calls putJobSuccessResult with the continuation token,
// which tells CodePipeline to re-invoke the Lambda with the token.
export const continuationRoute = defineRoute({
  filters: {
    functionName: FUNCTION_NAME,
    hasContinuationToken: true,
  },
}).handle(async ({ jobId, continuationToken }) => {
  const step = Number(continuationToken);
  console.log(`Continuing job ${jobId} at step ${step}`);

  const isComplete = step >= 3;
  if (!isComplete) {
    return { continuationToken: String(step + 1) };
  }
});
