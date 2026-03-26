import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { Artifact, CodePipelineEvent, Context, Credentials } from 'aws-lambda';

export interface CodePipelineJobRequest<TUserParameters = unknown> {
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

export type CodePipelineJobHandler<TUserParameters = unknown> = (
  request: CodePipelineJobRequest<TUserParameters>,
) => Promise<CodePipelineResponse>;

export interface CodePipelineFilterInput {
  functionName: string;
  userParameters: string;
  hasInputArtifacts: boolean;
  hasContinuationToken: boolean;
}

export interface CodePipelineFilters {
  functionNames?: string[];
  hasInputArtifacts?: boolean;
  hasContinuationToken?: boolean;
  userParametersContains?: string;
  customFilter?: (input: CodePipelineFilterInput) => boolean;
}

export interface CodePipelineRouteDefinition<TUserParameters = unknown> {
  filters: CodePipelineFilters;
  userParametersSchema?: StandardSchemaV1<unknown, TUserParameters>;
  handler: CodePipelineJobHandler<TUserParameters>;
}
