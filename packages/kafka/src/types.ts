import type {
  Context,
  MSKEvent,
  MSKRecord,
  MSKRecordHeader,
  SelfManagedKafkaEvent,
  SelfManagedKafkaRecord,
} from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { FilterStringMatcher, Middleware } from '@lambda-event-router/base';

export type KafkaRecord = MSKRecord | SelfManagedKafkaRecord;

export type KafkaEvent = MSKEvent | SelfManagedKafkaEvent;

export type KafkaDecodedHeader = Record<string, string>;

export interface KafkaFilterInput {
  headers: KafkaDecodedHeader[];
  topic: string;
  record: KafkaRecord;
}

export interface KafkaFilters {
  topic?: FilterStringMatcher;
  eventSourceArn?: FilterStringMatcher;
  bootstrapServer?: FilterStringMatcher;
  customFilter?: (input: KafkaFilterInput) => boolean | Promise<boolean>;
}

export interface KafkaRequest<TValue = unknown> {
  value: TValue;
  key: string | undefined;
  topic: string;
  partition: number;
  offset: number;
  timestamp: number;
  headers: KafkaDecodedHeader[];
  record: KafkaRecord;
  context: Context;
}

export type KafkaResponse = undefined;

export type KafkaMiddleware<TValue = unknown> = Middleware<KafkaRequest<TValue>, void>;

export interface KafkaRouteDefinition<TValue = unknown> {
  filters: KafkaFilters;
  valueSchema?: StandardSchemaV1<unknown, TValue>;
  middleware?: KafkaMiddleware<TValue>[];
  handler: (request: KafkaRequest<TValue>) => Promise<void>;
}

export interface KafkaRouterOptions {
  batchItemFailures?: boolean;
  middleware?: KafkaMiddleware[];
}

export interface KafkaBatchItemIdentifier {
  partition: string;
  offset: number;
}

export interface KafkaBatchResponse {
  batchItemFailures: Array<{ itemIdentifier: KafkaBatchItemIdentifier }>;
}

export type KafkaRecordHeader = MSKRecordHeader;
