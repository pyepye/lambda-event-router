import type { Middleware } from '@lambda-event-router/base';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { SNSMessageAttributes as AWSSNSMessageAttributes, Context, SNSEventRecord } from 'aws-lambda';

export type SNSRawMessageAttributes = AWSSNSMessageAttributes;
export type SNSMessageAttributes = Record<string, string>;

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
  messageAttributes: SNSRawMessageAttributes;
  record: SNSEventRecord;
}

export interface SNSFilters {
  topicArns?: string[];
  subjects?: string[];
  messageAttributes?: Record<string, string[]>;
  customFilter?: (input: SNSFilterInput) => boolean;
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
