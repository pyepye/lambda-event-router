import type { Context, KinesisStreamRecord } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { FilterStringMatcher, Middleware } from '@lambda-event-router/base';

export interface KinesisFilterInput {
  data: unknown;
  partitionKey: string;
  record: KinesisStreamRecord;
}

export interface KinesisFilters {
  eventSourceArn?: FilterStringMatcher;
  partitionKey?: FilterStringMatcher;
  custom?: (input: KinesisFilterInput) => boolean | Promise<boolean>;
}

export interface KinesisRequest<TData = unknown> {
  data: TData;
  partitionKey: string;
  sequenceNumber: string;
  approximateArrivalTimestamp: number;
  record: KinesisStreamRecord;
  context: Context;
}

export type KinesisResponse = undefined;

export type KinesisMiddleware<TData = unknown> = Middleware<KinesisRequest<TData>, void>;

export interface KinesisRouteDefinition<TData = unknown> {
  filters: KinesisFilters;
  dataSchema?: StandardSchemaV1<unknown, TData>;
  middleware?: KinesisMiddleware<NoInfer<TData>>[];
  handler: (request: KinesisRequest<TData>) => Promise<void>;
}

export interface KinesisRouterOptions {
  batchItemFailures?: boolean;
  middleware?: KinesisMiddleware[];
}
