import type { Artifact, CodePipelineEvent, Context, Credentials } from 'aws-lambda';
import { createMockContext } from './context.js';
import { deepMerge } from './deepMerge.js';
import type { DeepPartial } from './deepPartial.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

export type CodePipelineEventOverrides = DeepPartial<CodePipelineEvent> & {
  id?: string;
  accountId?: string;
  functionName?: string;
  userParameters?: string;
  inputArtifacts?: Artifact[];
  outputArtifacts?: Artifact[];
  artifactCredentials?: Credentials;
  continuationToken?: string;
};

export interface CodePipelineHandlerEvent {
  event: CodePipelineEvent;
  context: Context;
}

export interface CreateCodePipelineHandlerEventOptions {
  event?: CodePipelineEventOverrides;
  context?: Partial<Context>;
}

function createDefaultArtifact(name: string): Artifact {
  return {
    name,
    revision: null,
    location: {
      type: 'S3',
      s3Location: {
        bucketName: 'codepipeline-us-east-1-123456789012',
        objectKey: `my-pipeline/my-action/${crypto.randomUUID()}.zip`,
      },
    },
  };
}

function createDefaultCredentials(): Credentials {
  return {
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    sessionToken: 'FwoGZXIvYXdzEBYaDExampleSessionToken',
  };
}

export function createCodePipelineEvent(overrides: CodePipelineEventOverrides = {}): CodePipelineEvent {
  const {
    id,
    accountId,
    functionName,
    userParameters,
    inputArtifacts,
    outputArtifacts,
    artifactCredentials,
    continuationToken,
    ...restOverrides
  } = overrides;

  const defaults: CodePipelineEvent = {
    'CodePipeline.job': {
      id: id ?? crypto.randomUUID(),
      accountId: accountId ?? '123456789012',
      data: {
        actionConfiguration: {
          configuration: {
            FunctionName: functionName ?? 'my-pipeline-function',
            UserParameters: userParameters ?? '',
          },
        },
        inputArtifacts: inputArtifacts ?? [createDefaultArtifact('MyAppSource')],
        outputArtifacts: outputArtifacts ?? [],
        artifactCredentials: artifactCredentials ?? createDefaultCredentials(),
        continuationToken,
      },
    },
  };

  return deepMerge(defaults, restOverrides);
}

export function createCodePipelineHandlerEvent(
  options: CreateCodePipelineHandlerEventOptions = {},
): CodePipelineHandlerEvent {
  const event = createCodePipelineEvent(options.event);
  const context = createMockContext(options.context);
  return { event, context };
}

export interface CodePipelineFixtures {
  codePipelineEvent: (overrides?: CodePipelineEventOverrides) => CodePipelineEvent;
  codePipelineHandlerEvent: (options?: CreateCodePipelineHandlerEventOptions) => CodePipelineHandlerEvent;
}

export const codePipelineFixtures: FixtureMap<CodePipelineFixtures> = {
  codePipelineEvent: fixture(createCodePipelineEvent),
  codePipelineHandlerEvent: fixture(createCodePipelineHandlerEvent),
};
