import type { Schema } from '@lambda-event-router/base';
import type { Context, FirehoseRecordMetadata, FirehoseTransformationEventRecord } from 'aws-lambda';
import type { FirehoseResponseResult } from './response.js';

export interface FirehoseFilterInput {
  data: unknown;
  recordId: string;
  approximateArrivalTimestamp: number;
  record: FirehoseTransformationEventRecord;
  metadata?: FirehoseRecordMetadata;
}

export interface FirehoseFilters {
  deliveryStreamArns?: string[];
  sourceKinesisStreamArns?: string[];
  customFilter?: (input: FirehoseFilterInput) => boolean;
}

export interface FirehoseRequest<TData = unknown> {
  data: TData;
  recordId: string;
  approximateArrivalTimestamp: number;
  record: FirehoseTransformationEventRecord;
  context: Context;
  metadata?: FirehoseRecordMetadata;
}

export type FirehoseResponse = FirehoseResponseResult;

export interface FirehoseRouteDefinition<TData = unknown> {
  filters: FirehoseFilters;
  dataSchema?: Schema<TData>;
  handler: (request: FirehoseRequest<TData>) => Promise<FirehoseResponse>;
}
