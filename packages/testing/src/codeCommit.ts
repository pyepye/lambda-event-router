import type { Context } from 'aws-lambda';

import { createMockContext } from './context.js';
import { deepMerge } from './deepMerge.js';
import type { DeepPartial } from './deepPartial.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

// CodeCommit has no @types/aws-lambda types, so we define the event shapes locally
// Based on: https://github.com/aws/aws-lambda-go/blob/main/events/code_commit.go

export interface CodeCommitReference {
  commit: string;
  ref: string;
  created?: boolean;
  deleted?: boolean;
}

export interface CodeCommitRecord {
  awsRegion: string;
  codecommit: { references: CodeCommitReference[] };
  customData?: string;
  eventId: string;
  eventName: string;
  eventPartNumber: number;
  eventSource: string;
  eventSourceARN: string;
  eventTime: string;
  eventTotalParts: number;
  eventTriggerConfigId: string;
  eventTriggerName: string;
  eventVersion: string;
  userIdentityARN: string;
}

export interface CodeCommitEvent {
  Records: CodeCommitRecord[];
}

export type CodeCommitReferenceOverrides = DeepPartial<CodeCommitReference>;

export type CodeCommitRecordOverrides = DeepPartial<CodeCommitRecord>;

export interface CodeCommitHandlerEvent {
  event: CodeCommitEvent;
  context: Context;
}

export interface CreateCodeCommitHandlerEventOptions {
  records?: CodeCommitRecord[];
  context?: Partial<Context>;
}

function randomHexString(length: number): string {
  const hexChars = '0123456789abcdef';
  let result = '';
  for (let index = 0; index < length; index++) {
    result += hexChars[Math.floor(Math.random() * hexChars.length)];
  }
  return result;
}

export function createCodeCommitReference(overrides: CodeCommitReferenceOverrides = {}): CodeCommitReference {
  const defaults: CodeCommitReference = {
    commit: randomHexString(40),
    ref: 'refs/heads/main',
  };

  return deepMerge(defaults, overrides);
}

export function createCodeCommitRecord(overrides: CodeCommitRecordOverrides = {}): CodeCommitRecord {
  const defaults: CodeCommitRecord = {
    awsRegion: 'us-east-1',
    codecommit: {
      references: [createCodeCommitReference()],
    },
    eventId: crypto.randomUUID(),
    eventName: 'TriggerEventTest',
    eventPartNumber: 1,
    eventSource: 'aws:codecommit',
    eventSourceARN: 'arn:aws:codecommit:us-east-1:123456789012:my-repo',
    eventTime: '2024-01-01T00:00:00.000+0000',
    eventTotalParts: 1,
    eventTriggerConfigId: crypto.randomUUID(),
    eventTriggerName: 'my-trigger',
    eventVersion: '1',
    userIdentityARN: 'arn:aws:iam::123456789012:user/test-user',
  };

  return deepMerge(defaults, overrides);
}

export function createCodeCommitEvent(records: CodeCommitRecord[] = [createCodeCommitRecord()]): CodeCommitEvent {
  return { Records: records };
}

export function createCodeCommitHandlerEvent(
  options: CreateCodeCommitHandlerEventOptions = {},
): CodeCommitHandlerEvent {
  const event = createCodeCommitEvent(options.records);
  const context = createMockContext(options.context);
  return { event, context };
}

export interface CodeCommitFixtures {
  codeCommitReference: (overrides?: CodeCommitReferenceOverrides) => CodeCommitReference;
  codeCommitRecord: (overrides?: CodeCommitRecordOverrides) => CodeCommitRecord;
  codeCommitEvent: (records?: CodeCommitRecord[]) => CodeCommitEvent;
  codeCommitHandlerEvent: (options?: CreateCodeCommitHandlerEventOptions) => CodeCommitHandlerEvent;
}

export const codeCommitFixtures: FixtureMap<CodeCommitFixtures> = {
  codeCommitReference: fixture(createCodeCommitReference),
  codeCommitRecord: fixture(createCodeCommitRecord),
  codeCommitEvent: fixture(createCodeCommitEvent),
  codeCommitHandlerEvent: fixture(createCodeCommitHandlerEvent),
};
