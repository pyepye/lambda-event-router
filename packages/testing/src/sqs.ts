import type { SQSRecord as AWSSQSRecord, Context, SQSEvent } from 'aws-lambda';

import { createMockContext } from './context.js';
import { deepMerge } from './deepMerge.js';
import type { DeepPartial } from './deepPartial.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

export interface SQSHandlerEvent {
  event: SQSEvent;
  context: Context;
}

export type SQSRecordOverrides = DeepPartial<AWSSQSRecord> & {
  body?: string | Record<string, unknown> | null;
};

export function createSQSRecord(overrides: SQSRecordOverrides = {}): AWSSQSRecord {
  const { body: bodyOverride, ...restOverrides } = overrides;
  const hasBodyOverride = Object.hasOwn(overrides, 'body');
  const body = hasBodyOverride && typeof bodyOverride !== 'string' ? JSON.stringify(bodyOverride) : bodyOverride;

  const defaults: AWSSQSRecord = {
    messageId: crypto.randomUUID(),
    receiptHandle: `receipt-handle-${crypto.randomUUID()}`,
    body: body ?? JSON.stringify({ action: 'processOrder', orderId: '12345' }),
    attributes: {
      ApproximateReceiveCount: '1',
      SentTimestamp: '1704067200000',
      SenderId: 'sender-001',
      ApproximateFirstReceiveTimestamp: '1704067200001',
    },
    messageAttributes: {
      eventType: {
        stringValue: 'order.created',
        stringListValues: [],
        binaryListValues: [],
        dataType: 'String',
      },
    },
    md5OfBody: 'abc123',
    eventSource: 'aws:sqs',
    eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:my-queue',
    awsRegion: 'us-east-1',
  };

  return deepMerge(defaults, restOverrides);
}

export function createSQSEvent(records: AWSSQSRecord[] = [createSQSRecord()]): SQSEvent {
  return { Records: records };
}

export interface CreateSQSHandlerEventOptions {
  records?: AWSSQSRecord[];
  context?: Partial<Context>;
}

export function createSQSHandlerEvent(options: CreateSQSHandlerEventOptions = {}): SQSHandlerEvent {
  const event = createSQSEvent(options.records);
  const context = createMockContext(options.context);
  return { event, context };
}

export interface SQSFixtures {
  sqsRecord: (overrides?: SQSRecordOverrides) => AWSSQSRecord;
  sqsEvent: (records?: AWSSQSRecord[]) => SQSEvent;
  sqsHandlerEvent: (options?: CreateSQSHandlerEventOptions) => SQSHandlerEvent;
}

export const sqsFixtures: FixtureMap<SQSFixtures> = {
  sqsRecord: fixture(createSQSRecord),
  sqsEvent: fixture(createSQSEvent),
  sqsHandlerEvent: fixture(createSQSHandlerEvent),
};
