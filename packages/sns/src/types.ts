import type { SNSMessageAttributes as AWSSNSMessageAttributes, Context, SNSEventRecord } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { FilterStringMatcher, Middleware } from '@lambda-event-router/base';

export type SNSRawMessageAttributes = AWSSNSMessageAttributes;
export type SNSStringArrayItem = string | number | boolean | null;
export type SNSMessageAttributeValue = string | number | Buffer | SNSStringArrayItem[];
export type SNSMessageAttributes = Record<string, SNSMessageAttributeValue>;

export interface SNSRequest<TBody = unknown, TMessageAttributes extends SNSMessageAttributes = SNSMessageAttributes> {
  body: TBody;
  messageAttributes: TMessageAttributes;
  record: SNSEventRecord;
  context: Context;
}

export type SNSResponse = undefined;

export type SNSMiddleware<
  TBody = unknown,
  TMessageAttributes extends SNSMessageAttributes = SNSMessageAttributes,
> = Middleware<SNSRequest<TBody, TMessageAttributes>, void>;

export type SNSRecordHandler<
  TBody = unknown,
  TMessageAttributes extends SNSMessageAttributes = SNSMessageAttributes,
> = (request: SNSRequest<TBody, TMessageAttributes>) => Promise<void>;

export interface SNSFilterInput {
  body: unknown;
  messageAttributes: SNSMessageAttributes;
  record: SNSEventRecord;
}

export interface SNSFilters {
  topicArn?: FilterStringMatcher;
  subject?: FilterStringMatcher;
  messageAttributes?: Record<string, FilterStringMatcher | number | number[]>;
  custom?: (input: SNSFilterInput) => boolean | Promise<boolean>;
}

export interface SNSRouteDefinition<
  TBody = unknown,
  TMessageAttributes extends SNSMessageAttributes = SNSMessageAttributes,
> {
  filters: SNSFilters;
  bodySchema?: StandardSchemaV1<unknown, TBody>;
  messageAttributesSchema?: StandardSchemaV1<unknown, TMessageAttributes>;
  middleware?: SNSMiddleware<TBody, TMessageAttributes>[];
  handler: SNSRecordHandler<TBody, TMessageAttributes>;
}

export interface SNSRouterOptions {
  batchItemFailures?: boolean;
  middleware?: SNSMiddleware[];
}
