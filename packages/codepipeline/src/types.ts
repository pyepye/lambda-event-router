import type { CodePipelineClient } from '@aws-sdk/client-codepipeline';
import type { Artifact, CodePipelineEvent, Context, Credentials } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { FilterStringMatcher, Middleware } from '@lambda-event-router/base';

export interface CodePipelineRequest<TUserParameters = unknown> {
  jobId: string;
  functionName: string;
  userParameters: TUserParameters;
  inputArtifacts: Artifact[];
  outputArtifacts: Artifact[];
  artifactCredentials: Credentials;
  continuationToken: string | undefined;
  event: CodePipelineEvent;
  context: Context;
}

export interface CodePipelineSuccessResult {
  outputVariables?: Record<string, string>;
  continuationToken?: string;
}

export type CodePipelineResponse = CodePipelineSuccessResult | undefined;

export type CodePipelineMiddleware = Middleware<CodePipelineRequest, CodePipelineResponse>;

export type CodePipelineHandler<TUserParameters = unknown> = (
  request: CodePipelineRequest<TUserParameters>,
) => Promise<CodePipelineResponse>;

export interface CodePipelineFilterInput<TUserParameters = unknown> {
  functionName: string;
  userParameters: TUserParameters;
  hasInputArtifacts: boolean;
  hasContinuationToken: boolean;
}

export interface CodePipelineFilters {
  functionName?: FilterStringMatcher;
  hasInputArtifacts?: boolean;
  hasContinuationToken?: boolean;
  // userParameters?: FilterStringMatcher;
  custom?: (input: CodePipelineFilterInput) => boolean | Promise<boolean>;
}

export interface CodePipelineRouteDefinition<TUserParameters = unknown> {
  filters: CodePipelineFilters;
  userParametersSchema?: StandardSchemaV1<unknown, TUserParameters>;
  middleware?: CodePipelineMiddleware[];
  handler: CodePipelineHandler<TUserParameters>;
}

export interface CodePipelineRouterOptions {
  client?: CodePipelineClient;
  middleware?: CodePipelineMiddleware[];
}
