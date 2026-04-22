import type { Context, SNSEvent, SNSEventRecord, SNSMessageAttribute } from 'aws-lambda';

import { createMockContext } from './context.js';
import { deepMerge } from './deepMerge.js';
import type { DeepPartial } from './deepPartial.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

export interface SNSHandlerEvent {
  event: SNSEvent;
  context: Context;
}

export type SNSRecordOverrides = Omit<DeepPartial<SNSEventRecord>, 'Sns'> & {
  Sns?: Omit<DeepPartial<SNSEventRecord['Sns']>, 'Message'> & {
    Message?: string | Record<string, unknown>;
  };
};

export function createSNSRecord(overrides: SNSRecordOverrides = {}): SNSEventRecord {
  const messageId = crypto.randomUUID();

  const defaultMessageAttributes: Record<string, SNSMessageAttribute> = {
    eventType: {
      Type: 'String',
      Value: 'order.created',
    },
  };

  const { Sns: snsOverrides, ...restOverrides } = overrides;
  const { Message: messageOverride, ...restSnsOverrides } = snsOverrides ?? {};

  const message = typeof messageOverride === 'object' ? JSON.stringify(messageOverride) : messageOverride;

  const defaults: SNSEventRecord = {
    EventVersion: '1.0',
    EventSubscriptionArn: 'arn:aws:sns:us-east-1:123456789012:my-topic:a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    EventSource: 'aws:sns',
    Sns: {
      SignatureVersion: '1',
      Timestamp: '2024-01-01T00:00:00.000Z',
      Signature: 'EXAMPLE_SIGNATURE',
      SigningCertUrl: 'https://sns.us-east-1.amazonaws.com/SimpleNotificationService-abc123.pem',
      MessageId: messageId,
      Message: message ?? JSON.stringify({ action: 'processOrder', orderId: '12345' }),
      MessageAttributes: defaultMessageAttributes,
      Type: 'Notification',
      UnsubscribeUrl: `https://sns.us-east-1.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:us-east-1:123456789012:my-topic:${messageId}`,
      TopicArn: 'arn:aws:sns:us-east-1:123456789012:my-topic',
      Subject: 'Order Notification',
    },
  };

  return deepMerge(deepMerge(defaults, restOverrides), { Sns: restSnsOverrides });
}

export function createSNSEvent(records: SNSEventRecord[] = [createSNSRecord()]): SNSEvent {
  return { Records: records };
}

export interface CreateSNSHandlerEventOptions {
  records?: SNSEventRecord[];
  context?: Partial<Context>;
}

export function createSNSHandlerEvent(options: CreateSNSHandlerEventOptions = {}): SNSHandlerEvent {
  const event = createSNSEvent(options.records);
  const context = createMockContext(options.context);
  return { event, context };
}

export interface SNSFixtures {
  snsRecord: (overrides?: SNSRecordOverrides) => SNSEventRecord;
  snsEvent: (records?: SNSEventRecord[]) => SNSEvent;
  snsHandlerEvent: (options?: CreateSNSHandlerEventOptions) => SNSHandlerEvent;
}

export const snsFixtures: FixtureMap<SNSFixtures> = {
  snsRecord: fixture(createSNSRecord),
  snsEvent: fixture(createSNSEvent),
  snsHandlerEvent: fixture(createSNSHandlerEvent),
};
