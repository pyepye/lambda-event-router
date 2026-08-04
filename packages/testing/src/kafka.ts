import type { Context } from 'aws-lambda';

import { createMockContext } from './context.js';
import { deepMerge } from './deepMerge.js';
import type { DeepPartial } from './deepPartial.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

export interface KafkaRecordHeader {
  [headerKey: string]: number[];
}

// A record produced without a key arrives with a null key, a tombstone with a null value, and a record
// produced with no headers with null headers.
export interface KafkaRecord {
  topic: string;
  partition: number;
  offset: number;
  timestamp: number;
  timestampType: 'CREATE_TIME' | 'LOG_APPEND_TIME';
  key?: string | null;
  value?: string | null;
  headers?: KafkaRecordHeader[] | null;
}

export interface KafkaMSKEvent {
  eventSource: 'aws:kafka';
  eventSourceArn: string;
  bootstrapServers: string;
  records: Record<string, KafkaRecord[]>;
}

export interface KafkaSelfManagedEvent {
  eventSource: 'SelfManagedKafka';
  bootstrapServers: string;
  records: Record<string, KafkaRecord[]>;
}

// Lambda re-delivers a batch reported through `batchItemFailures` as its records alone, with no
// `eventSource`, `eventSourceArn` or `bootstrapServers`.
export interface KafkaRetryEvent {
  // Absent, and declared so the union stays discriminated on it.
  eventSource?: undefined;
  records: Record<string, KafkaRecord[]>;
}

export type KafkaRecordOverrides = Omit<DeepPartial<KafkaRecord>, 'key' | 'value' | 'headers'> & {
  key?: string | null;
  value?: string | object | null;
  headers?: Record<string, string>[] | null;
};

export interface KafkaHandlerEvent {
  event: KafkaMSKEvent | KafkaSelfManagedEvent;
  context: Context;
}

export interface CreateKafkaHandlerEventOptions {
  recordsByTopicPartition?: Record<string, KafkaRecord[]>;
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

function encodeHeaders(headers: Record<string, string>[] | null | undefined): KafkaRecordHeader[] | null {
  if (headers === null) return null;

  return (headers ?? defaultHeaders).map((header) => {
    const encoded: KafkaRecordHeader = {};
    for (const [headerKey, headerValue] of Object.entries(header)) {
      encoded[headerKey] = encodeHeaderValue(headerValue);
    }
    return encoded;
  });
}

export function createKafkaRecord(overrides: KafkaRecordOverrides = {}): KafkaRecord {
  const { key, value, headers, ...restOverrides } = overrides;

  const defaults: KafkaRecord = {
    topic: 'test-topic',
    partition: 0,
    offset: 0,
    timestamp: Date.now(),
    timestampType: 'CREATE_TIME',
    key: encodeBase64(key === undefined ? 'test-key' : key),
    value: encodeBase64(resolveRecordValue(value)),
    headers: encodeHeaders(headers),
  };

  return deepMerge(defaults, restOverrides);
}

// Lambda keys `records` by topic and partition together, such as `orders-0`, and each entry holds
// only that partition's records. The router checkpoints a partition at a time, so a key that names a
// topic alone describes an event Lambda never sends.
export function createMSKEvent(
  recordsByTopicPartition: Record<string, KafkaRecord[]> = { 'test-topic-0': [createKafkaRecord()] },
): KafkaMSKEvent {
  return {
    eventSource: 'aws:kafka',
    eventSourceArn: 'arn:aws:kafka:us-east-1:123456789012:cluster/TestCluster/abc-123',
    bootstrapServers: 'broker1.example.com:9092,broker2.example.com:9092',
    records: recordsByTopicPartition,
  };
}

export function createSelfManagedKafkaEvent(
  recordsByTopicPartition: Record<string, KafkaRecord[]> = { 'test-topic-0': [createKafkaRecord()] },
): KafkaSelfManagedEvent {
  return {
    eventSource: 'SelfManagedKafka',
    bootstrapServers: 'broker1.example.com:9092,broker2.example.com:9092',
    records: recordsByTopicPartition,
  };
}

export function createKafkaRetryEvent(
  recordsByTopicPartition: Record<string, KafkaRecord[]> = { 'test-topic-0': [createKafkaRecord()] },
): KafkaRetryEvent {
  return { records: recordsByTopicPartition };
}

export function createKafkaHandlerEvent(options: CreateKafkaHandlerEventOptions = {}): KafkaHandlerEvent {
  const eventType = options.eventType ?? 'msk';
  const event =
    eventType === 'msk'
      ? createMSKEvent(options.recordsByTopicPartition)
      : createSelfManagedKafkaEvent(options.recordsByTopicPartition);
  const context = createMockContext(options.context);
  return { event, context };
}

export interface KafkaFixtures {
  kafkaRecord: (overrides?: KafkaRecordOverrides) => ReturnType<typeof createKafkaRecord>;
  kafkaMSKEvent: (recordsByTopicPartition?: Parameters<typeof createMSKEvent>[0]) => ReturnType<typeof createMSKEvent>;
  kafkaSelfManagedEvent: (
    recordsByTopicPartition?: Parameters<typeof createSelfManagedKafkaEvent>[0],
  ) => ReturnType<typeof createSelfManagedKafkaEvent>;
  kafkaRetryEvent: (
    recordsByTopicPartition?: Parameters<typeof createKafkaRetryEvent>[0],
  ) => ReturnType<typeof createKafkaRetryEvent>;
  kafkaHandlerEvent: (options?: CreateKafkaHandlerEventOptions) => KafkaHandlerEvent;
}

export const kafkaFixtures: FixtureMap<KafkaFixtures> = {
  kafkaRecord: fixture(createKafkaRecord),
  kafkaMSKEvent: fixture(createMSKEvent),
  kafkaSelfManagedEvent: fixture(createSelfManagedKafkaEvent),
  kafkaRetryEvent: fixture(createKafkaRetryEvent),
  kafkaHandlerEvent: fixture(createKafkaHandlerEvent),
};
