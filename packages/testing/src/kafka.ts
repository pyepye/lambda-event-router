import type { Context, MSKEvent, MSKRecord, SelfManagedKafkaEvent } from 'aws-lambda';
import { createMockContext } from './context.js';
import { deepMerge } from './deepMerge.js';
import type { DeepPartial } from './deepPartial.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

export type KafkaRecordOverrides = Omit<DeepPartial<MSKRecord>, 'key' | 'value' | 'headers'> & {
  key?: string;
  value?: string | object;
  headers?: Record<string, string>[];
};

export interface KafkaHandlerEvent {
  event: MSKEvent | SelfManagedKafkaEvent;
  context: Context;
}

export interface CreateKafkaHandlerEventOptions {
  recordsByTopic?: Record<string, MSKRecord[]>;
  eventType?: 'msk' | 'self-managed';
  context?: Partial<Context>;
}

function encodeHeaderValue(value: string): number[] {
  return Array.from(Buffer.from(value, 'utf-8'));
}

const defaultBody: string = JSON.stringify({ action: 'process', id: '123' });

export function createKafkaRecord(overrides: KafkaRecordOverrides = {}): MSKRecord {
  const { key, value, headers, ...restOverrides } = overrides;

  const keyString = key ?? 'test-key';
  const encodedKey = Buffer.from(keyString).toString('base64');

  const valueString = typeof value === 'object' ? JSON.stringify(value) : (value ?? defaultBody);
  const encodedValue = Buffer.from(valueString).toString('base64');

  const rawHeaders = headers ?? [{ 'content-type': 'application/json' }];
  const encodedHeaders = rawHeaders.map((header) => {
    const encoded: Record<string, number[]> = {};
    for (const [headerKey, headerValue] of Object.entries(header)) {
      encoded[headerKey] = encodeHeaderValue(headerValue);
    }
    return encoded;
  });

  const defaults: MSKRecord = {
    topic: 'test-topic',
    partition: 0,
    offset: 0,
    timestamp: Date.now(),
    timestampType: 'CREATE_TIME',
    key: encodedKey,
    value: encodedValue,
    headers: encodedHeaders,
  };

  return deepMerge(defaults, restOverrides);
}

export function createMSKEvent(
  recordsByTopic: Record<string, MSKRecord[]> = { 'test-topic': [createKafkaRecord()] },
): MSKEvent {
  return {
    eventSource: 'aws:kafka',
    eventSourceArn: 'arn:aws:kafka:us-east-1:123456789012:cluster/TestCluster/abc-123',
    bootstrapServers: 'broker1.example.com:9092,broker2.example.com:9092',
    records: recordsByTopic,
  };
}

export function createSelfManagedKafkaEvent(
  recordsByTopic: Record<string, MSKRecord[]> = { 'test-topic': [createKafkaRecord()] },
): SelfManagedKafkaEvent {
  return {
    eventSource: 'SelfManagedKafka',
    bootstrapServers: 'broker1.example.com:9092,broker2.example.com:9092',
    records: recordsByTopic,
  };
}

export function createKafkaHandlerEvent(options: CreateKafkaHandlerEventOptions = {}): KafkaHandlerEvent {
  const eventType = options.eventType ?? 'msk';
  const event =
    eventType === 'msk' ? createMSKEvent(options.recordsByTopic) : createSelfManagedKafkaEvent(options.recordsByTopic);
  const context = createMockContext(options.context);
  return { event, context };
}

export interface KafkaFixtures {
  kafkaRecord: (overrides?: KafkaRecordOverrides) => ReturnType<typeof createKafkaRecord>;
  kafkaMSKEvent: (recordsByTopic?: Parameters<typeof createMSKEvent>[0]) => ReturnType<typeof createMSKEvent>;
  kafkaSelfManagedEvent: (
    recordsByTopic?: Parameters<typeof createSelfManagedKafkaEvent>[0],
  ) => ReturnType<typeof createSelfManagedKafkaEvent>;
  kafkaHandlerEvent: (options?: CreateKafkaHandlerEventOptions) => KafkaHandlerEvent;
}

export const kafkaFixtures: FixtureMap<KafkaFixtures> = {
  kafkaRecord: fixture(createKafkaRecord),
  kafkaMSKEvent: fixture(createMSKEvent),
  kafkaSelfManagedEvent: fixture(createSelfManagedKafkaEvent),
  kafkaHandlerEvent: fixture(createKafkaHandlerEvent),
};
