import type { Context, FirehoseRecordMetadata, FirehoseTransformationEventRecord } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { Middleware } from '@lambda-event-router/base';

import type { FirehoseResponseResult } from './response.js';

export interface FirehoseFilterInput {
  data: unknown;
  recordId: string;
  approximateArrivalTimestamp: number;
  record: FirehoseTransformationEventRecord;
  metadata?: FirehoseRecordMetadata;
}

export interface FirehoseFilters {
  deliveryStreamArn?: string | string[];
  sourceKinesisStreamArn?: string | string[];
  customFilter?: (input: FirehoseFilterInput) => boolean | Promise<boolean>;
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

// TODO: Is unknown correct here? Can we infer etc?
export type FirehoseMiddleware = Middleware<FirehoseRequest<unknown>, FirehoseResponse>;

export interface FirehoseRouteDefinition<TData = unknown> {
  filters: FirehoseFilters;
  dataSchema?: StandardSchemaV1<unknown, TData>;
  middleware?: FirehoseMiddleware[];
  handler: (request: FirehoseRequest<TData>) => Promise<FirehoseResponse>;
}

export interface FirehoseRouterOptions {
  middleware?: FirehoseMiddleware[];
}
