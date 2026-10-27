import { logger } from '@latcher/base';
import { defineRoute } from '@latcher/codepipeline';

import { NOTIFIER_FUNCTION_NAME } from '../environment.js';

// The notifier is a second deployment of this same bundle, so functionName is the only thing that
// separates its actions from the deployer's. This route carries no schema, and its action sets a
// UserParameters value that is not JSON, so the handler receives the raw string.
export const publishReleaseNotes = defineRoute({
  filters: {
    functionName: NOTIFIER_FUNCTION_NAME,
  },
}).handle(async (request) => {
  logger.info({
    message: 'Release notes published',
    jobId: request.jobId,
    userParameters: request.userParameters,
  });
});
