import { createCodePipelineRouter } from '@lambda-event-router/codepipeline';

import { codePipelineClient } from './environment.js';
import { awaitCanaryHealth } from './handlers/awaitCanaryHealth.js';
import { publishReleaseNotes } from './handlers/publishReleaseNotes.js';
import { rollbackRelease } from './handlers/rollbackRelease.js';
import { startCanaryDeployment } from './handlers/startCanaryDeployment.js';
import { verifyReleaseBundle } from './handlers/verifyReleaseBundle.js';
import { logJob } from './middleware/logJob.js';

export const codePipelineRouter = createCodePipelineRouter({
  client: codePipelineClient,
  middleware: [logJob],
});

// rollbackRelease claims any deployer job with no input artifacts, which makes it the broadest
// deployer route, so the router tries the narrower ones first.
codePipelineRouter
  .route(publishReleaseNotes)
  .route(verifyReleaseBundle)
  .route(startCanaryDeployment)
  .continuation(awaitCanaryHealth)
  .route(rollbackRelease);
