import type { Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { EventTypeRouter, Middleware } from '@lambda-event-router/base';
import {
  filterStringMatcher,
  handleEventWithMiddleware,
  isObject,
  logger,
  safeJsonParse,
  validateSchema,
} from '@lambda-event-router/base';

import type { InternalRoute, RouteBuilder, RouteInput } from './routeTypes.js';
import type {
  KafkaBatchResponse,
  KafkaDecodedHeader,
  KafkaEvent,
  KafkaHeaders,
  KafkaMSKEvent,
  KafkaRecord,
  KafkaRecordHeader,
  KafkaRequest,
  KafkaRetryEvent,
  KafkaRouteDefinition,
  KafkaRouterOptions,
} from './types.js';

export function defineRoute<
  TValueSchema extends StandardSchemaV1 | undefined = undefined,
  TValue = TValueSchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TValueSchema> : unknown,
>(config: RouteInput<TValueSchema, TValue>): RouteBuilder<TValue> {
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
    if (eventSource === 'aws:kafka' || eventSource === 'SelfManagedKafka') return true;

    // A re-delivered batch names no source, so the records themselves are the only thing left to
    // recognise it by.
    return eventSource === undefined && this.holdsKafkaRecords(event.records);
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
    if (!this.batchItemFailures) {
      const records = this.flattenRecords(event);
      await this.processRecordsSequentially(records, event, context);
      return;
    }

    const batchItemFailures = await this.processRecordsWithFailures(event, context);
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
    event: KafkaEvent,
    context: Context,
  ): Promise<KafkaBatchResponse['batchItemFailures']> {
    const failures: KafkaBatchResponse['batchItemFailures'] = [];

    // Kafka guarantees order within a partition and Lambda checkpoints each partition. A failure in one partition
    // must not skip or fail records in another. Process each partition on its own; on the first failure, report that
    // record and every later record in the same partition before moving onto the next.
    for (const partitionRecords of Object.values(event.records)) {
      for (const [index, record] of partitionRecords.entries()) {
        try {
          await this.processRecord(record, event, context);
        } catch (error) {
          const recordIdentifier = `${record.topic}-${record.partition} offset ${record.offset}`;
          logger.error(`Error processing Kafka record ${recordIdentifier}`, { error });
          for (const remaining of partitionRecords.slice(index)) {
            failures.push({
              itemIdentifier: { partition: `${remaining.topic}-${remaining.partition}`, offset: remaining.offset },
            });
          }
          break;
        }
      }
    }
    return failures;
  }

  private isMSKEvent(event: KafkaEvent): event is KafkaMSKEvent {
    return event.eventSource === 'aws:kafka';
  }

  // A re-delivered batch carries neither the cluster ARN nor the broker list. The event source
  // mapping has already pinned those records to a cluster this function consumes, so a filter on
  // either has nothing left to decide.
  private isRetryDelivery(event: KafkaEvent): event is KafkaRetryEvent {
    return event.eventSource === undefined;
  }

  // Every entry of a Kafka `records` map is one partition's records, and each record carries the
  // topic, partition and offset the router reads.
  private holdsKafkaRecords(records: Record<string, unknown>): boolean {
    const partitions = Object.values(records);
    if (partitions.length === 0) return false;

    return partitions.every(
      (partitionRecords) =>
        Array.isArray(partitionRecords) &&
        partitionRecords.length > 0 &&
        partitionRecords.every(
          (record) =>
            isObject(record) &&
            typeof record.topic === 'string' &&
            typeof record.partition === 'number' &&
            typeof record.offset === 'number',
        ),
    );
  }

  private decodeHeaders(headers: KafkaRecordHeader[] | null | undefined): KafkaDecodedHeader[] {
    if (!headers) return [];

    return headers.map((header) => {
      const decoded: KafkaDecodedHeader = {};
      for (const [headerKey, bytes] of Object.entries(header)) {
        decoded[headerKey] = Buffer.from(bytes).toString('utf-8');
      }
      return decoded;
    });
  }

  private decodeBase64(value: string | null | undefined): string | undefined {
    if (value === null || value === undefined) return undefined;
    return Buffer.from(value, 'base64').toString('utf-8');
  }

  private flattenHeaders(headerList: KafkaDecodedHeader[]): KafkaHeaders {
    return Object.assign({}, ...headerList) as KafkaHeaders;
  }

  private isTombstone(record: KafkaRecord): boolean {
    return record.value === null || record.value === undefined;
  }

  private async processRecord(record: KafkaRecord, event: KafkaEvent, context: Context): Promise<void> {
    const headerList = this.decodeHeaders(record.headers);
    const headers = this.flattenHeaders(headerList);
    const tombstone = this.isTombstone(record);

    const route = await this.matchRoute(record, event, headers, headerList, tombstone);
    if (!route) {
      throw new Error(`No route matched for record on topic ${record.topic} partition ${record.partition}`);
    }

    const key = this.decodeBase64(record.key);
    const rawValue = this.decodeBase64(record.value);
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
      headers,
      headerList,
      tombstone,
      record,
      context,
    };

    const allMiddleware = [...this.middleware, ...route.middleware];
    await handleEventWithMiddleware(allMiddleware, request, route.handler);
  }

  private async matchRoute(
    record: KafkaRecord,
    event: KafkaEvent,
    headers: KafkaHeaders,
    headerList: KafkaDecodedHeader[],
    tombstone: boolean,
  ): Promise<InternalRoute | undefined> {
    for (const route of this.routes) {
      const { filters } = route;

      if (filters.topic) {
        const topicMatch = filterStringMatcher(record.topic, filters.topic);
        if (!topicMatch) continue;
      }

      if (filters.tombstone !== undefined && filters.tombstone !== tombstone) continue;

      const retryDelivery = this.isRetryDelivery(event);

      if (filters.eventSourceArn && !retryDelivery) {
        if (!this.isMSKEvent(event)) continue;

        const eventSourceArnMatch = filterStringMatcher(event.eventSourceArn, filters.eventSourceArn);
        if (!eventSourceArnMatch) continue;
      }

      if (filters.bootstrapServer && !retryDelivery) {
        const { bootstrapServer } = filters; // Needed here due to TS having different scope for  separate function closure
        const bootstrapServers = event.bootstrapServers.split(',');
        const bootstrapServerMatch = bootstrapServers.some((server) => filterStringMatcher(server, bootstrapServer));
        if (!bootstrapServerMatch) continue;
      }

      if (filters.custom) {
        const match = await filters.custom({ headers, headerList, topic: record.topic, tombstone, record });
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
