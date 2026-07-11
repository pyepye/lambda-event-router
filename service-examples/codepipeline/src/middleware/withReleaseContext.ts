import { logger } from '@lambda-event-router/base';
import type { CodePipelineMiddleware } from '@lambda-event-router/codepipeline';

import type { TVerifyParameters } from '../utils/schemas.js';

// Route middleware for the verify route. Typed to that route's UserParameters so it slots onto
// verifyReleaseBundle without widening it.
export const withReleaseContext: CodePipelineMiddleware<TVerifyParameters> = async (request, next) => {
  logger.info({
    message: 'Release context resolved',
    environment: request.userParameters.environment,
    bundleName: request.userParameters.bundleName,
  });
  return next(request);
};
