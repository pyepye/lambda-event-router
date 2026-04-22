import type { Context, KinesisStreamEvent, KinesisStreamRecord } from 'aws-lambda';

import { createMockContext } from './context.js';
import { deepMerge } from './deepMerge.js';
import type { DeepPartial } from './deepPartial.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

export type KinesisRecordOverrides = Omit<DeepPartial<KinesisStreamRecord>, 'kinesis'> & {
  kinesis?: Omit<DeepPartial<KinesisStreamRecord['kinesis']>, 'data'> & {
    data?: string | Record<string, unknown>;
  };
};

export interface KinesisHandlerEvent {
  event: KinesisStreamEvent;
  context: Context;
}

export interface CreateKinesisHandlerEventOptions {
  records?: KinesisStreamRecord[];
  context?: Partial<Context>;
}

export function createKinesisRecord(overrides: KinesisRecordOverrides = {}): KinesisStreamRecord {
  const defaultBody = { action: 'processOrder', orderId: '12345' };
  const defaultEncodedData = Buffer.from(JSON.stringify(defaultBody)).toString('base64');

  const { kinesis: kinesisOverrides, ...restOverrides } = overrides;
  const { data: dataOverride, ...restKinesisOverrides } = kinesisOverrides ?? {};

  const dataString = typeof dataOverride === 'object' ? JSON.stringify(dataOverride) : dataOverride;
  const encodedData = dataString !== undefined ? Buffer.from(dataString).toString('base64') : defaultEncodedData;

  const defaults: KinesisStreamRecord = {
    kinesis: {
      data: encodedData,
      partitionKey: 'partition-key-1',
      sequenceNumber: crypto.randomUUID(),
      approximateArrivalTimestamp: 1704067200,
      kinesisSchemaVersion: '1.0',
    },
    eventID: crypto.randomUUID(),
    eventVersion: '1.0',
    eventSource: 'aws:kinesis',
    eventSourceARN: 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream',
    eventName: 'aws:kinesis:record',
    invokeIdentityArn: 'arn:aws:iam::123456789012:role/lambda-role',
    awsRegion: 'us-east-1',
  };

  return deepMerge(deepMerge(defaults, restOverrides), { kinesis: restKinesisOverrides });
}

export function createKinesisEvent(records: KinesisStreamRecord[] = [createKinesisRecord()]): KinesisStreamEvent {
  return { Records: records };
}

export function createKinesisHandlerEvent(options: CreateKinesisHandlerEventOptions = {}): KinesisHandlerEvent {
  const event = createKinesisEvent(options.records);
  const context = createMockContext(options.context);
  return { event, context };
}

export interface KinesisFixtures {
  kinesisRecord: (overrides?: KinesisRecordOverrides) => KinesisStreamRecord;
  kinesisEvent: (records?: KinesisStreamRecord[]) => KinesisStreamEvent;
  kinesisHandlerEvent: (options?: CreateKinesisHandlerEventOptions) => KinesisHandlerEvent;
}

export const kinesisFixtures: FixtureMap<KinesisFixtures> = {
  kinesisRecord: fixture(createKinesisRecord),
  kinesisEvent: fixture(createKinesisEvent),
  kinesisHandlerEvent: fixture(createKinesisHandlerEvent),
};
