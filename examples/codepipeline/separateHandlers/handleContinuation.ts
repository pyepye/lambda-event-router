import type { CodePipelineJobRequest, CodePipelineResponse } from '@lambda-event-router/codepipeline';

// Return a continuationToken to signal the job is still in progress.
// The router calls putJobSuccessResult with the continuation token,
// which tells CodePipeline to re-invoke the Lambda with the token.
export async function handleContinuation({
  jobId,
  continuationToken,
}: CodePipelineJobRequest): Promise<CodePipelineResponse> {
  const step = Number(continuationToken);
  console.log(`Continuing job ${jobId} at step ${step}`);

  const isComplete = step >= 3;
  if (!isComplete) {
    return { continuationToken: String(step + 1) };
  }
}
