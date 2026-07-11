import { logger } from '@lambda-event-router/base';
import type { CodePipelineMiddleware } from '@lambda-event-router/codepipeline';

// Router middleware: runs once per job, before any route middleware, for every function.
export const logJob: CodePipelineMiddleware = async (request, next) => {
  logger.info({
    message: 'Handling CodePipeline job',
    jobId: request.jobId,
    functionName: request.functionName,
    hasInputArtifacts: request.inputArtifacts.length > 0,
    continuationToken: request.continuationToken,
  });
  return next(request);
};
