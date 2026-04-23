import type { Context, MSKEvent } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { EventTypeRouter, Middleware } from '@lambda-event-router/base';
import { handleEventWithMiddleware, isObject, logger, safeJsonParse, validateSchema } from '@lambda-event-router/base';

import type { InternalRoute, RouteBuilder, RouteInput } from './routeTypes.js';
import type {
  KafkaBatchResponse,
  KafkaDecodedHeader,
  KafkaEvent,
  KafkaRecord,
  KafkaRecordHeader,
  KafkaRequest,
  KafkaRouteDefinition,
  KafkaRouterOptions,
} from './types.js';

export function defineRoute<
  TValueSchema extends StandardSchemaV1 | undefined = undefined,
  TValue = TValueSchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TValueSchema> : unknown,
>(config: RouteInput<TValueSchema>): RouteBuilder<TValue> {
  return {
    // biome-ignore lint/nursery/useExplicitType: handler type is inferred from RouteBuilder return type
    handle(handler): KafkaRouteDefinition<TValue> {
      return {
        filters: config.filters,
        valueSchema: config.valueSchema as StandardSchemaV1<unknown, TValue> | undefined,
        middleware: config.middleware as KafkaRouteDefinition<TValue>['middleware'],
        handler: handler as (request: KafkaRequest<TValue>) => Promise<void>,
      };
    },
  };
}

export class KafkaRouter implements EventTypeRouter<KafkaEvent, undefined | KafkaBatchResponse> {
  private routes: InternalRoute[] = [];
  private batchItemFailures: boolean;
  private middleware: Middleware<KafkaRequest, void>[];

  constructor(options?: KafkaRouterOptions) {
    this.batchItemFailures = options?.batchItemFailures ?? false;
    this.middleware = options?.middleware ?? [];
  }

  canHandleEvent(event: unknown): event is KafkaEvent {
    if (!isObject(event)) return false;
    if (!isObject(event.records)) return false;

    const eventSource = event.eventSource;
    return eventSource === 'aws:kafka' || eventSource === 'SelfManagedKafka';
  }

  route<TValue>(definition: KafkaRouteDefinition<TValue>): this {
    this.routes.push({
      filters: definition.filters,
      valueSchema: definition.valueSchema,
      // @ts-expect-error Contravariance: typed middleware stored in general InternalRoute, safe because schema validates before calling
      middleware: definition.middleware ?? [],
      // @ts-expect-error Contravariance: typed handler stored in general InternalRoute, safe because schema validates before calling
      handler: definition.handler,
    });
    return this;
  }

  async handleEvent(event: KafkaEvent, context: Context): Promise<undefined | KafkaBatchResponse> {
    const records = this.flattenRecords(event);

    if (!this.batchItemFailures) {
      await this.processRecordsSequentially(records, event, context);
      return;
    }

    const batchItemFailures = await this.processRecordsWithFailures(records, event, context);
    if (batchItemFailures.length > 0) {
      return { batchItemFailures };
    }
  }

  private flattenRecords(event: KafkaEvent): KafkaRecord[] {
    const records: KafkaRecord[] = [];
    for (const topicRecords of Object.values(event.records)) {
      for (const record of topicRecords) {
        records.push(record);
      }
    }
    return records;
  }

  private async processRecordsSequentially(records: KafkaRecord[], event: KafkaEvent, context: Context): Promise<void> {
    for (const record of records) {
      await this.processRecord(record, event, context);
    }
  }

  private async processRecordsWithFailures(
    records: KafkaRecord[],
    event: KafkaEvent,
    context: Context,
  ): Promise<KafkaBatchResponse['batchItemFailures']> {
    const failures: KafkaBatchResponse['batchItemFailures'] = [];

    for (const [index, record] of records.entries()) {
      try {
        await this.processRecord(record, event, context);
      } catch (error) {
        const recordIdentifier = `${record.topic}-${record.partition}-${record.offset}`;
        logger.error(`Error processing Kafka record ${recordIdentifier}`, { error });
        for (const remaining of records.slice(index)) {
          const itemIdentifier = `${remaining.topic}-${remaining.partition}-${remaining.offset}`;
          failures.push({ itemIdentifier });
        }
        break;
      }
    }
    return failures;
  }

  private isMSKEvent(event: KafkaEvent): event is MSKEvent {
    return event.eventSource === 'aws:kafka';
  }

  private decodeHeaders(headers: KafkaRecordHeader[]): KafkaDecodedHeader[] {
    return headers.map((header) => {
      const decoded: KafkaDecodedHeader = {};
      for (const [headerKey, bytes] of Object.entries(header)) {
        decoded[headerKey] = Buffer.from(bytes).toString('utf-8');
      }
      return decoded;
    });
  }

  private async processRecord(record: KafkaRecord, event: KafkaEvent, context: Context): Promise<void> {
    const decodedHeaders = this.decodeHeaders(record.headers);

    const route = await this.matchRoute(record, event, decodedHeaders);
    if (!route) {
      throw new Error(`No route matched for record on topic ${record.topic} partition ${record.partition}`);
    }

    const key = Buffer.from(record.key, 'base64').toString('utf-8');
    const rawValue = Buffer.from(record.value, 'base64').toString('utf-8');
    const parsedValue = safeJsonParse(rawValue);

    const validatedValue = await validateSchema(
      parsedValue,
      route.valueSchema,
      `Value validation failed for record on topic ${record.topic} partition ${record.partition}`,
    );

    const request: KafkaRequest = {
      value: validatedValue,
      key,
      topic: record.topic,
      partition: record.partition,
      offset: record.offset,
      timestamp: record.timestamp,
      headers: decodedHeaders,
      record,
      context,
    };

    const allMiddleware = [...this.middleware, ...route.middleware];
    await handleEventWithMiddleware(allMiddleware, request, route.handler);
  }

  private async matchRoute(
    record: KafkaRecord,
    event: KafkaEvent,
    decodedHeaders: KafkaDecodedHeader[],
  ): Promise<InternalRoute | undefined> {
    for (const route of this.routes) {
      const { filters } = route;

      if (filters.topic) {
        const topics = Array.isArray(filters.topic) ? filters.topic : [filters.topic];
        if (!topics.includes(record.topic)) {
          continue;
        }
      }

      if (filters.eventSourceArn) {
        if (!this.isMSKEvent(event)) {
          continue;
        }
        const { eventSourceArn: filterSourceArn } = filters;
        const eventSourceArns = Array.isArray(filterSourceArn) ? filterSourceArn : [filterSourceArn];
        if (!eventSourceArns.includes(event.eventSourceArn)) {
          continue;
        }
      }

      if (filters.bootstrapServer) {
        const { bootstrapServer: filterBootstrap } = filters;
        const bootstrapServers = Array.isArray(filterBootstrap) ? filterBootstrap : [filterBootstrap];
        const eventServers = event.bootstrapServers.split(',');
        const hasMatchingServer = bootstrapServers.some((server) => eventServers.includes(server));
        if (!hasMatchingServer) {
          continue;
        }
      }

      if (filters.customFilter) {
        const match = await filters.customFilter({ headers: decodedHeaders, topic: record.topic, record });
        if (!match) continue;
      }

      return route;
    }

    return undefined;
  }
}

export function createKafkaRouter(options?: KafkaRouterOptions): KafkaRouter {
  return new KafkaRouter(options);
}
