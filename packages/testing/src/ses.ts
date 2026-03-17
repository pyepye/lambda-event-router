import type { Context, SESEvent, SESEventRecord, SESMail, SESReceipt } from 'aws-lambda';
import { createMockContext } from './context.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

export interface SESHandlerEvent {
  event: SESEvent;
  context: Context;
}

export type SESRecordOverrides = Omit<Partial<SESEventRecord>, 'ses'> & {
  ses?: Partial<Omit<SESEventRecord['ses'], 'mail' | 'receipt'>> & {
    mail?: Partial<Omit<SESMail, 'commonHeaders'>> & {
      commonHeaders?: Partial<SESMail['commonHeaders']>;
    };
    receipt?: Partial<SESReceipt>;
  };
};

export function createSESRecord(overrides: SESRecordOverrides = {}): SESEventRecord {
  const { ses: sesOverrides, ...restOverrides } = overrides;
  const { mail: mailOverrides, receipt: receiptOverrides } = sesOverrides ?? {};
  const { commonHeaders: commonHeadersOverrides, ...restMailOverrides } = mailOverrides ?? {};

  const messageId = mailOverrides?.messageId ?? crypto.randomUUID();

  const defaultCommonHeaders: SESMail['commonHeaders'] = {
    returnPath: 'sender@example.com',
    from: ['sender@example.com'],
    date: '2024-01-01T00:00:00.000Z',
    to: ['recipient@example.com'],
    messageId: `<${messageId}@mail.example.com>`,
    subject: 'Test Email Subject',
    ...commonHeadersOverrides,
  };

  const defaultMail: SESMail = {
    timestamp: '2024-01-01T00:00:00.000Z',
    source: 'sender@example.com',
    messageId,
    destination: ['recipient@example.com'],
    headersTruncated: false,
    headers: [
      { name: 'From', value: 'sender@example.com' },
      { name: 'To', value: 'recipient@example.com' },
      { name: 'Subject', value: 'Test Email Subject' },
    ],
    commonHeaders: defaultCommonHeaders,
    ...restMailOverrides,
  };

  const defaultReceipt: SESReceipt = {
    timestamp: '2024-01-01T00:00:00.000Z',
    processingTimeMillis: 500,
    recipients: ['recipient@example.com'],
    spamVerdict: { status: 'PASS' },
    virusVerdict: { status: 'PASS' },
    spfVerdict: { status: 'PASS' },
    dkimVerdict: { status: 'PASS' },
    dmarcVerdict: { status: 'PASS' },
    action: {
      type: 'Lambda',
      functionArn: 'arn:aws:lambda:us-east-1:123456789012:function:my-ses-handler',
      invocationType: 'Event',
    },
    ...receiptOverrides,
  };

  return {
    eventSource: 'aws:ses',
    eventVersion: '1.0',
    ses: {
      mail: defaultMail,
      receipt: defaultReceipt,
    },
    ...restOverrides,
  };
}

export function createSESEvent(records: SESEventRecord[] = [createSESRecord()]): SESEvent {
  return { Records: records };
}

export interface CreateSESHandlerEventOptions {
  records?: SESEventRecord[];
  context?: Partial<Context>;
}

export function createSESHandlerEvent(options: CreateSESHandlerEventOptions = {}): SESHandlerEvent {
  const event = createSESEvent(options.records);
  const context = createMockContext(options.context);
  return { event, context };
}

export interface SESFixtures {
  sesRecord: (overrides?: SESRecordOverrides) => SESEventRecord;
  sesEvent: (records?: SESEventRecord[]) => SESEvent;
  sesHandlerEvent: (options?: CreateSESHandlerEventOptions) => SESHandlerEvent;
}

export const sesFixtures: FixtureMap<SESFixtures> = {
  sesRecord: fixture(createSESRecord),
  sesEvent: fixture(createSESEvent),
  sesHandlerEvent: fixture(createSESHandlerEvent),
};
