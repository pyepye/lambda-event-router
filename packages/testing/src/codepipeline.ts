import type { Artifact, CodePipelineEvent, Context, Credentials } from 'aws-lambda';
import { createMockContext } from './context.js';

export interface CodePipelineEventOverrides {
  id?: string;
  accountId?: string;
  functionName?: string;
  userParameters?: string;
  inputArtifacts?: Artifact[];
  outputArtifacts?: Artifact[];
  artifactCredentials?: Credentials;
  continuationToken?: string;
}

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
  return {
    'CodePipeline.job': {
      id: overrides.id ?? crypto.randomUUID(),
      accountId: overrides.accountId ?? '123456789012',
      data: {
        actionConfiguration: {
          configuration: {
            FunctionName: overrides.functionName ?? 'my-pipeline-function',
            UserParameters: overrides.userParameters ?? '',
          },
        },
        inputArtifacts: overrides.inputArtifacts ?? [createDefaultArtifact('MyAppSource')],
        outputArtifacts: overrides.outputArtifacts ?? [],
        artifactCredentials: overrides.artifactCredentials ?? createDefaultCredentials(),
        continuationToken: overrides.continuationToken,
      },
    },
  };
}

export function createCodePipelineHandlerEvent(
  options: CreateCodePipelineHandlerEventOptions = {},
): CodePipelineHandlerEvent {
  const event = createCodePipelineEvent(options.event);
  const context = createMockContext(options.context);
  return { event, context };
}
