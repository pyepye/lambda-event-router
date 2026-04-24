import type { SQSRecord as AWSSQSRecord, Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { FilterStringMatcher, Middleware } from '@lambda-event-router/base';

export type SQSMessageAttributeValue = string | number | Buffer;
export type SQSMessageAttributes = Record<string, SQSMessageAttributeValue>;

export interface SQSRequest<TBody = unknown, TMessageAttributes extends SQSMessageAttributes = SQSMessageAttributes> {
  body: TBody;
  messageAttributes: TMessageAttributes;
  record: AWSSQSRecord;
  context: Context;
}

export type SQSResponse = undefined;

export type SQSRecordHandler<
  TBody = unknown,
  TMessageAttributes extends SQSMessageAttributes = SQSMessageAttributes,
> = (request: SQSRequest<TBody, TMessageAttributes>) => Promise<void>;

export type SQSMiddleware<
  TBody = unknown,
  TMessageAttributes extends SQSMessageAttributes = SQSMessageAttributes,
> = Middleware<SQSRequest<TBody, TMessageAttributes>, void>;

export interface SQSFilterInput {
  body: unknown;
  messageAttributes: SQSMessageAttributes;
  record: AWSSQSRecord;
}

export interface SQSFilters {
  eventSourceArn?: FilterStringMatcher;
  messageAttributes?: Record<string, FilterStringMatcher | number | number[]>;
  customFilter?: (input: SQSFilterInput) => boolean | Promise<boolean>;
}

export interface SQSRouteDefinition<
  TBody = unknown,
  TMessageAttributes extends SQSMessageAttributes = SQSMessageAttributes,
> {
  filters: SQSFilters;
  bodySchema?: StandardSchemaV1<unknown, TBody>;
  messageAttributesSchema?: StandardSchemaV1<unknown, TMessageAttributes>;
  middleware?: SQSMiddleware<TBody, TMessageAttributes>[];
  handler: SQSRecordHandler<TBody, TMessageAttributes>;
}

export interface SQSRouterOptions {
  batchItemFailures?: boolean;
  middleware?: SQSMiddleware[];
}
