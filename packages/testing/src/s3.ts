import type { Context, S3BatchEvent, S3BatchEventTask, S3Event, S3EventRecord } from 'aws-lambda';

import { createMockContext } from './context.js';
import { deepMerge } from './deepMerge.js';
import type { DeepPartial } from './deepPartial.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

export interface S3HandlerEvent {
  event: S3Event;
  context: Context;
}

export interface S3BatchHandlerEvent {
  event: S3BatchEvent;
  context: Context;
}

export type S3RecordOverrides = DeepPartial<S3EventRecord>;

export function createS3Record(overrides: S3RecordOverrides = {}): S3EventRecord {
  const defaults: S3EventRecord = {
    eventVersion: '2.1',
    eventSource: 'aws:s3',
    awsRegion: 'us-east-1',
    eventTime: '2024-01-01T00:00:00.000Z',
    eventName: 'ObjectCreated:Put',
    userIdentity: { principalId: 'EXAMPLE' },
    requestParameters: { sourceIPAddress: '127.0.0.1' },
    responseElements: {
      'x-amz-request-id': 'EXAMPLE123456789',
      'x-amz-id-2': 'EXAMPLE123/5678abcdefghijklambdaisawesome/mnopqrstuvwxyzABCDEFGH',
    },
    s3: {
      s3SchemaVersion: '1.0',
      configurationId: 'testConfigRule',
      bucket: {
        name: 'my-bucket',
        ownerIdentity: { principalId: 'EXAMPLE' },
        arn: 'arn:aws:s3:::my-bucket',
      },
      object: {
        key: 'uploads/test-file.txt',
        size: 1024,
        eTag: '0123456789abcdef0123456789abcdef',
        sequencer: '0A1B2C3D4E5F678901',
      },
    },
  };

  return deepMerge(defaults, overrides);
}

export function createS3Event(records: S3EventRecord[] = [createS3Record()]): S3Event {
  return { Records: records };
}

export interface CreateS3HandlerEventOptions {
  records?: S3EventRecord[];
  context?: Partial<Context>;
}

export function createS3HandlerEvent(options: CreateS3HandlerEventOptions = {}): S3HandlerEvent {
  const event = createS3Event(options.records);
  const context = createMockContext(options.context);
  return { event, context };
}

export type S3BatchTaskOverrides = DeepPartial<S3BatchEventTask>;

export function createS3BatchTask(overrides: S3BatchTaskOverrides = {}): S3BatchEventTask {
  const defaults: S3BatchEventTask = {
    taskId: crypto.randomUUID(),
    s3Key: 'uploads/test-file.txt',
    s3VersionId: '1',
    s3BucketArn: 'arn:aws:s3:::my-bucket',
  };

  return deepMerge(defaults, overrides);
}

export function createS3BatchEvent(
  overrides: Partial<Omit<S3BatchEvent, 'tasks'>> & { tasks?: S3BatchEventTask[] } = {},
): S3BatchEvent {
  const { tasks, ...restOverrides } = overrides;

  return {
    invocationSchemaVersion: '1.0',
    invocationId: crypto.randomUUID(),
    job: {
      id: crypto.randomUUID(),
    },
    tasks: tasks ?? [createS3BatchTask()],
    ...restOverrides,
  };
}

export interface CreateS3BatchHandlerEventOptions {
  event?: Partial<Omit<S3BatchEvent, 'tasks'>> & { tasks?: S3BatchEventTask[] };
  context?: Partial<Context>;
}

export function createS3BatchHandlerEvent(options: CreateS3BatchHandlerEventOptions = {}): S3BatchHandlerEvent {
  const event = createS3BatchEvent(options.event);
  const context = createMockContext(options.context);
  return { event, context };
}

export interface S3Fixtures {
  s3Record: (overrides?: S3RecordOverrides) => S3EventRecord;
  s3Event: (records?: S3EventRecord[]) => S3Event;
  s3HandlerEvent: (options?: CreateS3HandlerEventOptions) => S3HandlerEvent;
  s3BatchTask: (overrides?: S3BatchTaskOverrides) => S3BatchEventTask;
  s3BatchEvent: (overrides?: Partial<Omit<S3BatchEvent, 'tasks'>> & { tasks?: S3BatchEventTask[] }) => S3BatchEvent;
  s3BatchHandlerEvent: (options?: CreateS3BatchHandlerEventOptions) => S3BatchHandlerEvent;
}

export const s3Fixtures: FixtureMap<S3Fixtures> = {
  s3Record: fixture(createS3Record),
  s3Event: fixture(createS3Event),
  s3HandlerEvent: fixture(createS3HandlerEvent),
  s3BatchTask: fixture(createS3BatchTask),
  s3BatchEvent: fixture(createS3BatchEvent),
  s3BatchHandlerEvent: fixture(createS3BatchHandlerEvent),
};
