import type { SQSRecord as AWSSQSRecord, Context, SQSEvent } from 'aws-lambda';
import { createMockContext } from './context.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

export interface SQSHandlerEvent {
  event: SQSEvent;
  context: Context;
}

export type SQSRecordOverrides = Omit<Partial<AWSSQSRecord>, 'attributes'> & {
  attributes?: Partial<AWSSQSRecord['attributes']>;
};

export function createSQSRecord(overrides: SQSRecordOverrides = {}): AWSSQSRecord {
  const { body: bodyOverride, attributes, messageAttributes, ...restOverrides } = overrides;
  const hasBodyOverride = Object.hasOwn(overrides, 'body');
  const body = hasBodyOverride && typeof bodyOverride !== 'string' ? JSON.stringify(bodyOverride) : bodyOverride;

  const defaultAttributes: AWSSQSRecord['attributes'] = {
    ApproximateReceiveCount: '1',
    SentTimestamp: '1704067200000',
    SenderId: 'sender-001',
    ApproximateFirstReceiveTimestamp: '1704067200001',
  };

  const defaultMessageAttributes: AWSSQSRecord['messageAttributes'] = {
    eventType: {
      stringValue: 'order.created',
      stringListValues: [],
      binaryListValues: [],
      dataType: 'String',
    },
  };

  return {
    messageId: crypto.randomUUID(),
    receiptHandle: `receipt-handle-${crypto.randomUUID()}`,
    body: body ?? JSON.stringify({ action: 'processOrder', orderId: '12345' }),
    attributes: { ...defaultAttributes, ...attributes },
    messageAttributes: messageAttributes ?? defaultMessageAttributes,
    md5OfBody: 'abc123',
    eventSource: 'aws:sqs',
    eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:my-queue',
    awsRegion: 'us-east-1',
    ...restOverrides,
  };
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
