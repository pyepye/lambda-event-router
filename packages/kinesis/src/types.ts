import type { Schema } from '@lambda-event-router/base';
import type { Context, KinesisStreamRecord } from 'aws-lambda';

export interface KinesisFilterInput {
  data: unknown;
  partitionKey: string;
  record: KinesisStreamRecord;
}

export interface KinesisFilters {
  eventSourceArns?: KinesisStreamRecord['eventSourceARN'][];
  partitionKeys?: string[];
  customFilter?: (input: KinesisFilterInput) => boolean;
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

export interface KinesisRouteDefinition<TData = unknown> {
  filters: KinesisFilters;
  dataSchema?: Schema<TData>;
  handler: (request: KinesisRequest<TData>) => Promise<void>;
}

export interface KinesisRouterOptions {
  batchItemFailures?: boolean;
}
