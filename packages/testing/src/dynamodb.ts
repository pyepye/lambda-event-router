import { marshall } from '@aws-sdk/util-dynamodb';
import type { AttributeValue, Context, DynamoDBRecord, DynamoDBStreamEvent } from 'aws-lambda';

import { createMockContext } from './context.js';
import { deepMerge } from './deepMerge.js';
import type { DeepPartial } from './deepPartial.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

// The SDK marshall returns its own AttributeValue type (Uint8Array for binary)
// while aws-lambda uses string for binary. For test data without binary fields,
// the runtime values are identical - only the types differ.
function marshallToLambda(input: Record<string, unknown>): Record<string, AttributeValue> {
  // @ts-expect-error SDK AttributeValue uses Uint8Array for binary, aws-lambda uses string
  return marshall(input);
}

export interface DynamoDBHandlerEvent {
  event: DynamoDBStreamEvent;
  context: Context;
}

export type DynamoDBRecordOverrides = DeepPartial<DynamoDBRecord> & {
  keys?: Record<string, unknown>;
  newImage?: Record<string, unknown>;
  oldImage?: Record<string, unknown>;
};

export function createDynamoDBRecord(overrides: DynamoDBRecordOverrides = {}): DynamoDBRecord {
  const { keys, newImage, oldImage, ...restOverrides } = overrides;

  const defaultKeys = keys ?? { pk: 'pk-123', sk: 'sk-123' };
  const defaultNewImage = newImage ?? { pk: 'pk-123', sk: 'sk-123', name: 'Test Item' };

  const defaults: DynamoDBRecord = {
    eventID: crypto.randomUUID(),
    eventName: 'INSERT',
    eventVersion: '1.1',
    eventSource: 'aws:dynamodb',
    awsRegion: 'us-east-1',
    eventSourceARN: 'arn:aws:dynamodb:us-east-1:123456789012:table/my-table/stream/2024-01-01T00:00:00.000',
    dynamodb: {
      ApproximateCreationDateTime: 1704067200,
      Keys: marshallToLambda(defaultKeys),
      NewImage: marshallToLambda(defaultNewImage),
      ...(oldImage ? { OldImage: marshallToLambda(oldImage) } : {}),
      SequenceNumber: '111',
      SizeBytes: 256,
      StreamViewType: 'NEW_AND_OLD_IMAGES',
    },
  };

  return deepMerge(defaults, restOverrides);
}

export function createDynamoDBInsertRecord(overrides: DynamoDBRecordOverrides = {}): DynamoDBRecord {
  return createDynamoDBRecord({ ...overrides, eventName: 'INSERT' });
}

export function createDynamoDBModifyRecord(overrides: DynamoDBRecordOverrides = {}): DynamoDBRecord {
  const defaultOldImage = overrides.oldImage ?? { pk: 'pk-123', sk: 'sk-123', name: 'Old Item' };
  return createDynamoDBRecord({ ...overrides, eventName: 'MODIFY', oldImage: defaultOldImage });
}

export function createDynamoDBRemoveRecord(overrides: DynamoDBRecordOverrides = {}): DynamoDBRecord {
  const { keys, oldImage, newImage: _newImage, ...restOverrides } = overrides;

  const defaultKeys = keys ?? { pk: 'pk-123', sk: 'sk-123' };
  const defaultOldImage = oldImage ?? { pk: 'pk-123', sk: 'sk-123', name: 'Deleted Item' };

  const defaults: DynamoDBRecord = {
    eventID: crypto.randomUUID(),
    eventName: 'REMOVE',
    eventVersion: '1.1',
    eventSource: 'aws:dynamodb',
    awsRegion: 'us-east-1',
    eventSourceARN: 'arn:aws:dynamodb:us-east-1:123456789012:table/my-table/stream/2024-01-01T00:00:00.000',
    dynamodb: {
      ApproximateCreationDateTime: 1704067200,
      Keys: marshallToLambda(defaultKeys),
      OldImage: marshallToLambda(defaultOldImage),
      SequenceNumber: '111',
      SizeBytes: 256,
      StreamViewType: 'NEW_AND_OLD_IMAGES',
    },
  };

  return deepMerge(defaults, restOverrides);
}

export function createDynamoDBEvent(records: DynamoDBRecord[] = [createDynamoDBRecord()]): DynamoDBStreamEvent {
  return { Records: records };
}

export interface CreateDynamoDBHandlerEventOptions {
  records?: DynamoDBRecord[];
  context?: Partial<Context>;
}

export function createDynamoDBHandlerEvent(options: CreateDynamoDBHandlerEventOptions = {}): DynamoDBHandlerEvent {
  const event = createDynamoDBEvent(options.records);
  const context = createMockContext(options.context);
  return { event, context };
}

export interface DynamoDBFixtures {
  dynamoDBRecord: (overrides?: DynamoDBRecordOverrides) => DynamoDBRecord;
  dynamoDBInsertRecord: (overrides?: DynamoDBRecordOverrides) => DynamoDBRecord;
  dynamoDBModifyRecord: (overrides?: DynamoDBRecordOverrides) => DynamoDBRecord;
  dynamoDBRemoveRecord: (overrides?: DynamoDBRecordOverrides) => DynamoDBRecord;
  dynamoDBStreamEvent: (records?: DynamoDBRecord[]) => DynamoDBStreamEvent;
  dynamoDBStreamHandlerEvent: (options?: CreateDynamoDBHandlerEventOptions) => DynamoDBHandlerEvent;
}

export const dynamoDBFixtures: FixtureMap<DynamoDBFixtures> = {
  dynamoDBRecord: fixture(createDynamoDBRecord),
  dynamoDBInsertRecord: fixture(createDynamoDBInsertRecord),
  dynamoDBModifyRecord: fixture(createDynamoDBModifyRecord),
  dynamoDBRemoveRecord: fixture(createDynamoDBRemoveRecord),
  dynamoDBStreamEvent: fixture(createDynamoDBEvent),
  dynamoDBStreamHandlerEvent: fixture(createDynamoDBHandlerEvent),
};
