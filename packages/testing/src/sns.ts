import type { Context, SNSEvent, SNSEventRecord, SNSMessageAttribute } from 'aws-lambda';
import { createMockContext } from './context.js';

export interface SNSHandlerEvent {
  event: SNSEvent;
  context: Context;
}

export type SNSRecordOverrides = Omit<Partial<SNSEventRecord>, 'Sns'> & {
  Sns?: Partial<SNSEventRecord['Sns']>;
};

export function createSNSRecord(overrides: SNSRecordOverrides = {}): SNSEventRecord {
  const { Sns: snsOverrides, ...restOverrides } = overrides;

  const defaultMessageAttributes: Record<string, SNSMessageAttribute> = {
    eventType: {
      Type: 'String',
      Value: 'order.created',
    },
  };

  const messageId = crypto.randomUUID();

  return {
    EventVersion: '1.0',
    EventSubscriptionArn: 'arn:aws:sns:us-east-1:123456789012:my-topic:a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    EventSource: 'aws:sns',
    Sns: {
      SignatureVersion: '1',
      Timestamp: '2024-01-01T00:00:00.000Z',
      Signature: 'EXAMPLE_SIGNATURE',
      SigningCertUrl: 'https://sns.us-east-1.amazonaws.com/SimpleNotificationService-abc123.pem',
      MessageId: messageId,
      Message: JSON.stringify({ action: 'processOrder', orderId: '12345' }),
      MessageAttributes: defaultMessageAttributes,
      Type: 'Notification',
      UnsubscribeUrl: `https://sns.us-east-1.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:us-east-1:123456789012:my-topic:${messageId}`,
      TopicArn: 'arn:aws:sns:us-east-1:123456789012:my-topic',
      Subject: 'Order Notification',
      ...snsOverrides,
    },
    ...restOverrides,
  };
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
