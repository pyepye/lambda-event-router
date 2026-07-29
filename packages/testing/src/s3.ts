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

// Schema 2.0 is what a job on a directory bucket sends, and what any job passing userArguments sends.
// The task names the bucket rather than its ARN, and aws-lambda declares no type for either shape.
export interface S3BatchV2EventTask {
  taskId: string;
  s3Key: string;
  s3VersionId: string | null;
  s3Bucket: string;
}

export interface S3BatchV2Event {
  invocationSchemaVersion: '2.0';
  invocationId: string;
  job: {
    id: string;
    userArguments?: Record<string, string>;
  };
  tasks: S3BatchV2EventTask[];
}

export type S3BatchV2TaskOverrides = DeepPartial<S3BatchV2EventTask>;

export function createS3BatchV2Task(overrides: S3BatchV2TaskOverrides = {}): S3BatchV2EventTask {
  const defaults: S3BatchV2EventTask = {
    taskId: crypto.randomUUID(),
    s3Key: 'uploads/test-file.txt',
    s3VersionId: null,
    s3Bucket: 'my-bucket',
  };

  return deepMerge(defaults, overrides);
}

export function createS3BatchV2Event(
  overrides: Partial<Omit<S3BatchV2Event, 'tasks'>> & { tasks?: S3BatchV2EventTask[] } = {},
): S3BatchV2Event {
  const { tasks, ...restOverrides } = overrides;

  return {
    invocationSchemaVersion: '2.0',
    invocationId: crypto.randomUUID(),
    job: {
      id: crypto.randomUUID(),
      userArguments: { source: 'test' },
    },
    tasks: tasks ?? [createS3BatchV2Task()],
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

// A bucket sends this once, when a notification configuration is saved. aws-lambda declares no type
// for it, so the shape is declared here.
export interface S3TestEvent {
  Service: 'Amazon S3';
  Event: 's3:TestEvent';
  Time: string;
  Bucket: string;
  RequestId: string;
  HostId: string;
}

export type S3TestEventOverrides = DeepPartial<S3TestEvent>;

export function createS3TestEvent(overrides: S3TestEventOverrides = {}): S3TestEvent {
  const defaults: S3TestEvent = {
    Service: 'Amazon S3',
    Event: 's3:TestEvent',
    Time: '2024-01-01T00:00:00.000Z',
    Bucket: 'test-bucket',
    RequestId: crypto.randomUUID(),
    HostId: 'test-host-id',
  };

  return deepMerge(defaults, overrides);
}

export interface S3Fixtures {
  s3Record: (overrides?: S3RecordOverrides) => S3EventRecord;
  s3Event: (records?: S3EventRecord[]) => S3Event;
  s3HandlerEvent: (options?: CreateS3HandlerEventOptions) => S3HandlerEvent;
  s3BatchTask: (overrides?: S3BatchTaskOverrides) => S3BatchEventTask;
  s3BatchEvent: (overrides?: Partial<Omit<S3BatchEvent, 'tasks'>> & { tasks?: S3BatchEventTask[] }) => S3BatchEvent;
  s3BatchHandlerEvent: (options?: CreateS3BatchHandlerEventOptions) => S3BatchHandlerEvent;
  s3TestEvent: (overrides?: S3TestEventOverrides) => S3TestEvent;
  s3BatchV2Task: (overrides?: S3BatchV2TaskOverrides) => S3BatchV2EventTask;
  s3BatchV2Event: (
    overrides?: Partial<Omit<S3BatchV2Event, 'tasks'>> & { tasks?: S3BatchV2EventTask[] },
  ) => S3BatchV2Event;
}

export const s3Fixtures: FixtureMap<S3Fixtures> = {
  s3Record: fixture(createS3Record),
  s3Event: fixture(createS3Event),
  s3HandlerEvent: fixture(createS3HandlerEvent),
  s3BatchTask: fixture(createS3BatchTask),
  s3BatchEvent: fixture(createS3BatchEvent),
  s3BatchHandlerEvent: fixture(createS3BatchHandlerEvent),
  s3TestEvent: fixture(createS3TestEvent),
  s3BatchV2Task: fixture(createS3BatchV2Task),
  s3BatchV2Event: fixture(createS3BatchV2Event),
};
