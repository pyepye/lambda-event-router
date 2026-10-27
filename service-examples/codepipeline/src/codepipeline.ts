import { createCodePipelineMatcher } from '@latcher/codepipeline';

import { codePipelineClient } from './environment.js';
import { awaitCanaryHealth } from './handlers/awaitCanaryHealth.js';
import { publishReleaseNotes } from './handlers/publishReleaseNotes.js';
import { rollbackRelease } from './handlers/rollbackRelease.js';
import { startCanaryDeployment } from './handlers/startCanaryDeployment.js';
import { verifyReleaseBundle } from './handlers/verifyReleaseBundle.js';
import { logJob } from './middleware/logJob.js';

export const codePipelineMatcher = createCodePipelineMatcher({
  client: codePipelineClient,
  middleware: [logJob],
});

// rollbackRelease claims any deployer job with no input artifacts, which makes it the broadest
// deployer route, so the matcher tries the narrower ones first.
codePipelineMatcher
  .route(publishReleaseNotes)
  .route(verifyReleaseBundle)
  .route(startCanaryDeployment)
  .continuation(awaitCanaryHealth)
  .route(rollbackRelease);
