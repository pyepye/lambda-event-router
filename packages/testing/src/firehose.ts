import type { Context, FirehoseTransformationEvent, FirehoseTransformationEventRecord } from 'aws-lambda';
import { createMockContext } from './context.js';
import type { DeepPartial } from './deepPartial.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

export type FirehoseRecordOverrides = DeepPartial<FirehoseTransformationEventRecord>;

export interface FirehoseEventOverrides {
  deliveryStreamArn?: string;
  sourceKinesisStreamArn?: string;
}

export interface FirehoseHandlerEvent {
  event: FirehoseTransformationEvent;
  context: Context;
}

export interface CreateFirehoseHandlerEventOptions {
  records?: FirehoseTransformationEventRecord[];
  eventOverrides?: FirehoseEventOverrides;
  context?: Partial<Context>;
}

export function createFirehoseRecord(overrides: FirehoseRecordOverrides = {}): FirehoseTransformationEventRecord {
  const defaultBody = { action: 'processOrder', orderId: '12345' };
  const hasDataOverride = Object.hasOwn(overrides, 'data');

  let encodedData: string;
  if (hasDataOverride) {
    encodedData = overrides.data as string;
  } else {
    encodedData = Buffer.from(JSON.stringify(defaultBody)).toString('base64');
  }

  return {
    recordId: overrides.recordId ?? crypto.randomUUID(),
    data: encodedData,
    approximateArrivalTimestamp: overrides.approximateArrivalTimestamp ?? 1704067200,
    kinesisRecordMetadata:
      overrides.kinesisRecordMetadata as FirehoseTransformationEventRecord['kinesisRecordMetadata'],
  };
}

export function createFirehoseEvent(
  records: FirehoseTransformationEventRecord[] = [createFirehoseRecord()],
  overrides: FirehoseEventOverrides = {},
): FirehoseTransformationEvent {
  const event: FirehoseTransformationEvent = {
    records,
    invocationId: crypto.randomUUID(),
    deliveryStreamArn:
      overrides.deliveryStreamArn ?? 'arn:aws:firehose:us-east-1:123456789012:deliverystream/my-stream',
    region: 'us-east-1',
  };

  if (overrides.sourceKinesisStreamArn) {
    event.sourceKinesisStreamArn = overrides.sourceKinesisStreamArn;
  }

  return event;
}

export function createFirehoseHandlerEvent(options: CreateFirehoseHandlerEventOptions = {}): FirehoseHandlerEvent {
  const event = createFirehoseEvent(options.records, options.eventOverrides);
  const context = createMockContext(options.context);
  return { event, context };
}

export interface FirehoseFixtures {
  firehoseRecord: (overrides?: FirehoseRecordOverrides) => FirehoseTransformationEventRecord;
  firehoseEvent: (
    records?: FirehoseTransformationEventRecord[],
    overrides?: FirehoseEventOverrides,
  ) => FirehoseTransformationEvent;
  firehoseHandlerEvent: (options?: CreateFirehoseHandlerEventOptions) => FirehoseHandlerEvent;
}

export const firehoseFixtures: FixtureMap<FirehoseFixtures> = {
  firehoseRecord: fixture(createFirehoseRecord),
  firehoseEvent: fixture(createFirehoseEvent),
  firehoseHandlerEvent: fixture(createFirehoseHandlerEvent),
};
