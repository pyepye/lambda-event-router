import type { SQSRecord as AWSSQSRecord, Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { FilterStringMatcher, Middleware } from '@lambda-event-router/base';

export type SQSMessageAttributeValue = string | string[] | number | Buffer;
export type SQSMessageAttributes = Record<string, SQSMessageAttributeValue>;
export type SQSMessageAttributeFilter = FilterStringMatcher | number | number[];

export interface SQSRequest<TBody = unknown, TMessageAttributes = SQSMessageAttributes> {
  body: TBody;
  messageAttributes: TMessageAttributes;
  record: AWSSQSRecord;
  context: Context;
}

export type SQSResponse = undefined;

export type SQSRecordHandler<TBody = unknown, TMessageAttributes = SQSMessageAttributes> = (
  request: SQSRequest<TBody, TMessageAttributes>,
) => Promise<void>;

export type SQSMiddleware<TBody = unknown, TMessageAttributes = SQSMessageAttributes> = Middleware<
  SQSRequest<TBody, TMessageAttributes>,
  void
>;

export interface SQSFilterInput {
  body: unknown;
  messageAttributes: SQSMessageAttributes;
  record: AWSSQSRecord;
}

export interface SQSFilters {
  eventSourceArn?: FilterStringMatcher;
  messageAttributes?: Record<string, SQSMessageAttributeFilter>;
  custom?: (input: SQSFilterInput) => boolean | Promise<boolean>;
}

export interface SQSRouteDefinition<TBody = unknown, TMessageAttributes = SQSMessageAttributes> {
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
