import type { Handler } from 'aws-lambda';

import { LambdaRouter } from '@lambda-event-router/base';
import { type CodePipelineFilterInput, createCodePipelineRouter } from '@lambda-event-router/codepipeline';

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
    functionName: FUNCTION_NAME,
    hasInputArtifacts: true,
  },
  userParametersSchema: ArtifactParametersSchema,
  handler: processArtifacts,
});

codePipelineRouter.route({
  filters: {
    functionName: FUNCTION_NAME,
    userParametersContains: 'deploy',
  },
  userParametersSchema: ArtifactParametersSchema,
  handler: processArtifacts,
});

codePipelineRouter.continuation({
  filters: {
    functionName: FUNCTION_NAME,
  },
  handler: handleContinuation,
});

function hasProductionConfig({ userParameters }: CodePipelineFilterInput): boolean {
  return userParameters.toLowerCase().includes('production');
}

codePipelineRouter.route({
  filters: {
    functionName: FUNCTION_NAME,
    hasInputArtifacts: true,
    customFilter: hasProductionConfig,
  },
  userParametersSchema: ArtifactParametersSchema,
  handler: processArtifacts,
});

const lambdaRouter = new LambdaRouter({
  routers: [codePipelineRouter],
});

export const handler: Handler = lambdaRouter.handler();
