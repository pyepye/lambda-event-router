import type { Schema } from '@lambda-event-router/base';
import type { SQSRecord as AWSSQSRecord, Context } from 'aws-lambda';

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

export interface SQSFilterInput {
  body: unknown;
  messageAttributes: SQSMessageAttributes;
  record: AWSSQSRecord;
}

export interface SQSFilters {
  eventSourceArns?: AWSSQSRecord['eventSourceARN'][];
  messageAttributes?: Record<string, (string | number)[]>;
  customFilter?: (input: SQSFilterInput) => boolean;
}

export interface SQSRouteDefinition<
  TBody = unknown,
  TMessageAttributes extends SQSMessageAttributes = SQSMessageAttributes,
> {
  filters: SQSFilters;
  bodySchema?: Schema<TBody>;
  messageAttributesSchema?: Schema<TMessageAttributes>;
  handler: SQSRecordHandler<TBody, TMessageAttributes>;
}

export interface SQSRouterOptions {
  batchItemFailures?: boolean;
}
