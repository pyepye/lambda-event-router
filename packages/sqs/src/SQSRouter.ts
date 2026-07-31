import type {
  SQSMessageAttribute as AWSSQSMessageAttribute,
  SQSRecord as AWSSQSRecord,
  Context,
  SQSBatchResponse,
  SQSEvent,
} from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { EventTypeRouter, Middleware } from '@lambda-event-router/base';
import {
  filterStringMatcher,
  handleEventWithMiddleware,
  isObject,
  logger,
  orderRoutesBySpecificity,
  safeJsonParse,
  validateSchema,
} from '@lambda-event-router/base';

import type {
  SQSFilters,
  SQSMessageAttributeFilter,
  SQSMessageAttributes,
  SQSMessageAttributeValue,
  SQSRecordHandler,
  SQSRequest,
  SQSRouteDefinition,
  SQSRouterOptions,
} from './types.js';

interface InternalRoute {
  filters: SQSFilters;
  bodySchema?: StandardSchemaV1;
  messageAttributesSchema?: StandardSchemaV1;
  middleware: Middleware<SQSRequest, void>[];
  handler: SQSRecordHandler;
}

interface RouteInput<
  TBodySchema extends StandardSchemaV1 | undefined = undefined,
  TMessageAttributesSchema extends StandardSchemaV1 | undefined = undefined,
  TBody = TBodySchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TBodySchema> : unknown,
  TMessageAttributes extends SQSMessageAttributes = TMessageAttributesSchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TMessageAttributesSchema> & SQSMessageAttributes
    : SQSMessageAttributes,
> {
  filters: SQSFilters;
  bodySchema?: TBodySchema;
  messageAttributesSchema?: TMessageAttributesSchema;
  middleware?: Middleware<SQSRequest<TBody, TMessageAttributes>, void>[];
}

interface RouteBuilder<TBody, TMessageAttributes extends SQSMessageAttributes> {
  handle(handler: SQSRecordHandler<TBody, TMessageAttributes>): SQSRouteDefinition<TBody, TMessageAttributes>;
}

export function defineRoute<
  TBodySchema extends StandardSchemaV1 | undefined = undefined,
  TMessageAttributesSchema extends StandardSchemaV1 | undefined = undefined,
  TBody = TBodySchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TBodySchema> : unknown,
  TMessageAttributes extends SQSMessageAttributes = TMessageAttributesSchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TMessageAttributesSchema> & SQSMessageAttributes
    : SQSMessageAttributes,
>(config: RouteInput<TBodySchema, TMessageAttributesSchema>): RouteBuilder<TBody, TMessageAttributes> {
  return {
    // biome-ignore lint/nursery/useExplicitType: handler type is inferred from RouteBuilder return type
    handle(handler): SQSRouteDefinition<TBody, TMessageAttributes> {
      return { ...config, handler } as SQSRouteDefinition<TBody, TMessageAttributes>;
    },
  };
}

function isStringArray(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false;

  return value.every((item) => typeof item === 'string');
}

export class SQSRouter implements EventTypeRouter<SQSEvent, undefined | SQSBatchResponse> {
  private routes: InternalRoute[] = [];
  private routesOrdered = false;
  private batchItemFailures: boolean;
  private middleware: Middleware<SQSRequest, void>[];

  constructor(options?: SQSRouterOptions) {
    this.batchItemFailures = options?.batchItemFailures ?? false;
    this.middleware = options?.middleware ?? [];
  }

  canHandleEvent(event: unknown): event is SQSEvent {
    if (!isObject(event)) return false;
    if (!Array.isArray(event.Records)) return false;

    const firstRecord = event.Records[0];
    if (!isObject(firstRecord)) return false;

    return firstRecord.eventSource === 'aws:sqs';
  }

  route<TBody, TMessageAttributes extends SQSMessageAttributes>(
    definition: SQSRouteDefinition<TBody, TMessageAttributes>,
  ): this {
    this.routes.push({
      filters: definition.filters,
      bodySchema: definition.bodySchema,
      messageAttributesSchema: definition.messageAttributesSchema,
      // @ts-expect-error Contravariance: typed middleware stored in general InternalRoute, safe because schema validates before calling
      middleware: definition.middleware ?? [],
      handler: definition.handler as SQSRecordHandler,
    });
    this.routesOrdered = false;
    return this;
  }

  async handleEvent(event: SQSEvent, context: Context): Promise<undefined | SQSBatchResponse> {
    /* v8 ignore next -- @preserve - Guard is for TS. AWS always sends at least one record */
    const isFifo = event.Records[0]?.eventSourceARN.endsWith('.fifo') ?? false;

    if (!this.batchItemFailures) {
      if (isFifo) {
        await this.processFifoRecords(event.Records, context);
      } else {
        const recordPromises = event.Records.map((record) => this.processRecord(record, context));
        await Promise.all(recordPromises);
      }
      return;
    }

    let batchItemFailures: SQSBatchResponse['batchItemFailures'];
    if (isFifo) {
      batchItemFailures = await this.processFifoRecordsWithFailures(event.Records, context);
    } else {
      batchItemFailures = await this.processStandardRecordsWithFailures(event.Records, context);
    }

    if (batchItemFailures.length > 0) {
      return { batchItemFailures };
    }
  }

  private async processStandardRecordsWithFailures(
    records: AWSSQSRecord[],
    context: Context,
  ): Promise<SQSBatchResponse['batchItemFailures']> {
    const recordPromises = records.map((record) => this.processRecord(record, context));
    const results = await Promise.allSettled(recordPromises);

    const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];
    for (const [idx, result] of results.entries()) {
      if (result.status === 'rejected') {
        const record = records[idx];
        /* v8 ignore next -- @preserve - Guard is for TS. Record will always exist as it has same length as results */
        if (record) {
          logger.error(`Error processing SQS record ${record.messageId}`, { error: result.reason });
          batchItemFailures.push({ itemIdentifier: record.messageId });
        }
      }
    }
    return batchItemFailures;
  }

  private async processFifoRecords(records: AWSSQSRecord[], context: Context): Promise<void> {
    const groups = this.groupRecordsByMessageGroupId(records);
    const groupPromises = groups.map((group) => this.processGroup(group, context));
    await Promise.all(groupPromises);
  }

  private async processFifoRecordsWithFailures(
    records: AWSSQSRecord[],
    context: Context,
  ): Promise<SQSBatchResponse['batchItemFailures']> {
    const groups = this.groupRecordsByMessageGroupId(records);
    const groupProcessPromises = groups.map((group) => this.processMessageGroupWithFailures(group, context));
    const groupResults = await Promise.all(groupProcessPromises);
    return groupResults.flat();
  }

  private async processGroup(records: AWSSQSRecord[], context: Context): Promise<void> {
    for (const record of records) {
      await this.processRecord(record, context);
    }
  }

  private async processMessageGroupWithFailures(
    records: AWSSQSRecord[],
    context: Context,
  ): Promise<SQSBatchResponse['batchItemFailures']> {
    const failures: SQSBatchResponse['batchItemFailures'] = [];
    for (const [idx, record] of records.entries()) {
      try {
        await this.processRecord(record, context);
      } catch (error) {
        logger.error(`Error processing SQS record ${record.messageId}`, { error });
        for (const remaining of records.slice(idx)) {
          failures.push({ itemIdentifier: remaining.messageId });
        }
        break;
      }
    }
    return failures;
  }

  private groupRecordsByMessageGroupId(records: AWSSQSRecord[]): AWSSQSRecord[][] {
    const groups = new Map<string, AWSSQSRecord[]>();
    for (const record of records) {
      /* v8 ignore next -- @preserve - Guard is for TS. FIFO records always have MessageGroupId */
      const groupId = record.attributes.MessageGroupId ?? '';
      const group = groups.get(groupId);
      if (group) {
        group.push(record);
      } else {
        groups.set(groupId, [record]);
      }
    }
    return [...groups.values()];
  }

  private convertMessageAttributes(raw: AWSSQSRecord['messageAttributes']): SQSMessageAttributes {
    const result: SQSMessageAttributes = {};
    for (const [key, attr] of Object.entries(raw)) {
      const value = this.convertMessageAttribute(attr);
      if (value !== undefined) {
        result[key] = value;
      }
    }
    return result;
  }

  // SQS keeps whatever label the publisher appended to the type, so `Number.float` and `Binary.gif`
  // arrive whole and the logical type is the part before the first dot.
  private convertMessageAttribute(attr: AWSSQSMessageAttribute): SQSMessageAttributeValue | undefined {
    const [logicalType] = attr.dataType.split('.');

    if (logicalType === 'Binary') {
      /* v8 ignore next -- @preserve - Guard is for TS. A Binary attribute always carries binaryValue but it is typed as optional */
      if (attr.binaryValue == null) return undefined;

      return Buffer.from(attr.binaryValue, 'base64');
    }

    /* v8 ignore next -- @preserve - Guard is for TS. Every other attribute carries stringValue but it is typed as optional */
    if (attr.stringValue == null) return undefined;

    if (logicalType === 'Number') return this.convertNumberAttribute(attr.stringValue);

    if (attr.dataType === 'String.Array') return this.convertStringArrayAttribute(attr.stringValue);

    return attr.stringValue;
  }

  // SQS accepts more digits than a number holds. A value that survives the round trip is exact, and
  // anything else stays as the text SQS sent, for a schema to convert however it needs to.
  private convertNumberAttribute(stringValue: string): number | string {
    const numberValue = Number(stringValue);
    if (String(numberValue) !== stringValue) return stringValue;

    return numberValue;
  }

  // A String.Array attribute carries its list as JSON text. Anything but a list of strings stays text
  // for a schema to deal with.
  private convertStringArrayAttribute(stringValue: string): string[] | string {
    const parsed = safeJsonParse(stringValue);
    if (!isStringArray(parsed)) return stringValue;

    return parsed;
  }

  private orderRoutes(): void {
    if (this.routesOrdered) return;

    this.routes = orderRoutesBySpecificity(this.routes);
    this.routesOrdered = true;
  }

  private async matchRoute(
    record: AWSSQSRecord,
    body: unknown,
    messageAttributes: SQSMessageAttributes,
  ): Promise<InternalRoute | undefined> {
    this.orderRoutes();

    for (const route of this.routes) {
      const { filters } = route;

      if (filters.eventSourceArn !== undefined) {
        const eventSourceArnMatch = filterStringMatcher(record.eventSourceARN, filters.eventSourceArn);
        if (!eventSourceArnMatch) continue;
      }

      if (filters.messageAttributes !== undefined) {
        let matched = true;
        for (const [key, allowed] of Object.entries(filters.messageAttributes)) {
          const attr = messageAttributes[key];
          if (attr === undefined || !this.matchMessageAttribute(attr, allowed)) {
            matched = false;
            break;
          }
        }
        if (!matched) continue;
      }

      if (filters.custom) {
        const match = await filters.custom({ body, messageAttributes, record });
        if (!match) continue;
      }

      return route;
    }
    return undefined;
  }

  private async processRecord(record: AWSSQSRecord, context: Context): Promise<void> {
    const parsedBody = safeJsonParse(record.body);
    const convertedAttributes = this.convertMessageAttributes(record.messageAttributes);

    const route = await this.matchRoute(record, parsedBody, convertedAttributes);
    if (!route) {
      throw new Error(`No route matched for record from ${record.eventSourceARN}`);
    }

    const body = await validateSchema(
      parsedBody,
      route.bodySchema,
      `Body validation failed for record ${record.messageId}`,
    );
    const messageAttributes = await validateSchema(
      convertedAttributes,
      route.messageAttributesSchema,
      `Message attributes validation failed for record ${record.messageId}`,
    );

    const request: SQSRequest = {
      body,
      messageAttributes,
      record,
      context,
    };

    const allMiddleware = [...this.middleware, ...route.middleware];
    await handleEventWithMiddleware(allMiddleware, request, route.handler);
  }

  private matchMessageAttribute(attr: SQSMessageAttributeValue, allowed: SQSMessageAttributeFilter): boolean {
    if (Array.isArray(allowed)) {
      return allowed.some((item) => this.matchMessageAttribute(attr, item));
    }

    if (typeof allowed === 'number') {
      return attr === allowed;
    }

    if (isStringArray(attr)) {
      return attr.some((item) => filterStringMatcher(item, allowed));
    }

    return typeof attr === 'string' && filterStringMatcher(attr, allowed);
  }
}

export function createSQSRouter(options?: SQSRouterOptions): SQSRouter {
  return new SQSRouter(options);
}
