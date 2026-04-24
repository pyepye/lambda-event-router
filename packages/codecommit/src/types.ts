import type { Context } from 'aws-lambda';

import type { FilterStringMatcher, Middleware } from '@lambda-event-router/base';

// AWS CodeCommit Lambda trigger event types
// No @types/aws-lambda types exist for CodeCommit
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

export interface CodeCommitRequest {
  references: CodeCommitReference[];
  userIdentityARN: string;
  eventTriggerName: string;
  eventSourceARN: string;
  record: CodeCommitRecord;
  context: Context;
}

export type CodeCommitResponse = undefined;

export type CodeCommitMiddleware = Middleware<CodeCommitRequest, void>;

export type CodeCommitRecordHandler = (request: CodeCommitRequest) => Promise<void>;

export interface CodeCommitFilterInput {
  references: CodeCommitReference[];
  userIdentityARN: string;
  eventSourceARN: string;
  eventTriggerName: string;
}

export interface CodeCommitFilters {
  eventSourceArn?: FilterStringMatcher;
  repositoryName?: FilterStringMatcher;
  branch?: FilterStringMatcher;
  customFilter?: (input: CodeCommitFilterInput) => boolean | Promise<boolean>;
}

export interface CodeCommitRouteDefinition {
  filters: CodeCommitFilters;
  middleware?: CodeCommitMiddleware[];
  handler: CodeCommitRecordHandler;
}

export interface CodeCommitRouterOptions {
  middleware?: CodeCommitMiddleware[];
}
