import type { Context, MSKEvent, MSKRecord, MSKRecordHeader, SelfManagedKafkaEvent } from 'aws-lambda';

import { createMockContext } from './context.js';
import { deepMerge } from './deepMerge.js';
import type { DeepPartial } from './deepPartial.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

export type KafkaRecordOverrides = Omit<DeepPartial<MSKRecord>, 'key' | 'value' | 'headers'> & {
  key?: string | null;
  value?: string | object | null;
  headers?: Record<string, string>[] | null;
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
const defaultHeaders: Record<string, string>[] = [{ 'content-type': 'application/json' }];

function encodeBase64(value: string | null): string | null {
  return value === null ? null : Buffer.from(value).toString('base64');
}

function resolveRecordValue(value: string | object | null | undefined): string | null {
  if (value === null) return null;
  if (value === undefined) return defaultBody;
  return typeof value === 'object' ? JSON.stringify(value) : value;
}

function encodeHeaders(headers: Record<string, string>[] | null | undefined): MSKRecordHeader[] | null {
  if (headers === null) return null;

  return (headers ?? defaultHeaders).map((header) => {
    const encoded: MSKRecordHeader = {};
    for (const [headerKey, headerValue] of Object.entries(header)) {
      encoded[headerKey] = encodeHeaderValue(headerValue);
    }
    return encoded;
  });
}

export function createKafkaRecord(overrides: KafkaRecordOverrides = {}): MSKRecord {
  const { key, value, headers, ...restOverrides } = overrides;

  const encodedKey = encodeBase64(key === undefined ? 'test-key' : key);
  const encodedValue = encodeBase64(resolveRecordValue(value));
  const encodedHeaders = encodeHeaders(headers);

  const defaults: MSKRecord = {
    topic: 'test-topic',
    partition: 0,
    offset: 0,
    timestamp: Date.now(),
    timestampType: 'CREATE_TIME',
    key: encodedKey as string,
    value: encodedValue as string,
    headers: encodedHeaders as MSKRecordHeader[],
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
