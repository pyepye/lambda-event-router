import { EventRouter } from '@lambda-event-router/base';
import { createCodePipelineRouter } from '@lambda-event-router/codepipeline';
import type { Handler } from 'aws-lambda';

import { handleContinuation } from './handleContinuation.js';
import { ArtifactParametersSchema, processArtifacts } from './processArtifacts.js';

// The router automatically calls putJobSuccessResult / putJobFailureResult
// based on whether the handler succeeds or throws.
// userParameters is parsed from JSON and validated against the schema by the router.
// Handlers can return outputVariables or continuationToken to include
// in the putJobSuccessResult call.
const codePipelineRouter = createCodePipelineRouter();

const FUNCTION_NAME = 'my-pipeline-deploy-function';

codePipelineRouter.route({
  filters: {
    functionNames: [FUNCTION_NAME],
    hasInputArtifacts: true,
  },
  userParametersSchema: ArtifactParametersSchema,
  handler: processArtifacts,
});

codePipelineRouter.route({
  filters: {
    functionNames: [FUNCTION_NAME],
    userParametersContains: 'deploy',
  },
  userParametersSchema: ArtifactParametersSchema,
  handler: processArtifacts,
});

codePipelineRouter.continuation({
  filters: {
    functionNames: [FUNCTION_NAME],
  },
  handler: handleContinuation,
});

const eventRouter = new EventRouter({
  routers: [codePipelineRouter],
});

export const handler: Handler = eventRouter.handler();
