import type { Context, KinesisStreamEvent, KinesisStreamRecord } from 'aws-lambda';
import { createMockContext } from './context.js';
import type { DeepPartial } from './deepPartial.js';

export type KinesisRecordOverrides = DeepPartial<KinesisStreamRecord>;

export interface KinesisHandlerEvent {
  event: KinesisStreamEvent;
  context: Context;
}

export interface CreateKinesisHandlerEventOptions {
  records?: KinesisStreamRecord[];
  context?: Partial<Context>;
}

export function createKinesisRecord(overrides: KinesisRecordOverrides = {}): KinesisStreamRecord {
  const { kinesis: kinesisOverrides, ...restOverrides } = overrides;

  const defaultBody = { action: 'processOrder', orderId: '12345' };
  const hasDataOverride = kinesisOverrides !== undefined && Object.hasOwn(kinesisOverrides, 'data');

  let encodedData: string;
  if (hasDataOverride) {
    encodedData = kinesisOverrides.data as string;
  } else {
    encodedData = Buffer.from(JSON.stringify(defaultBody)).toString('base64');
  }

  return {
    kinesis: {
      data: encodedData,
      partitionKey: kinesisOverrides?.partitionKey ?? 'partition-key-1',
      sequenceNumber: kinesisOverrides?.sequenceNumber ?? crypto.randomUUID(),
      approximateArrivalTimestamp: kinesisOverrides?.approximateArrivalTimestamp ?? 1704067200,
      kinesisSchemaVersion: kinesisOverrides?.kinesisSchemaVersion ?? '1.0',
    },
    eventID: restOverrides.eventID ?? crypto.randomUUID(),
    eventVersion: restOverrides.eventVersion ?? '1.0',
    eventSource: restOverrides.eventSource ?? 'aws:kinesis',
    eventSourceARN: restOverrides.eventSourceARN ?? 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream',
    eventName: restOverrides.eventName ?? 'aws:kinesis:record',
    invokeIdentityArn: restOverrides.invokeIdentityArn ?? 'arn:aws:iam::123456789012:role/lambda-role',
    awsRegion: restOverrides.awsRegion ?? 'us-east-1',
  };
}

export function createKinesisEvent(records: KinesisStreamRecord[] = [createKinesisRecord()]): KinesisStreamEvent {
  return { Records: records };
}

export function createKinesisHandlerEvent(options: CreateKinesisHandlerEventOptions = {}): KinesisHandlerEvent {
  const event = createKinesisEvent(options.records);
  const context = createMockContext(options.context);
  return { event, context };
}
