import type { EventTypeRouter, InferSchema, Schema } from '@lambda-event-router/base';
import { isObject } from '@lambda-event-router/base';
import type { Context, MSKEvent } from 'aws-lambda';
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
  TValueSchema extends Schema<unknown> | undefined = undefined,
  TValue = TValueSchema extends Schema<unknown> ? InferSchema<TValueSchema> : unknown,
>(config: RouteInput<TValueSchema>): RouteBuilder<TValue> {
  return {
    // biome-ignore lint/nursery/useExplicitType: handler type is inferred from RouteBuilder return type
    handle(handler): KafkaRouteDefinition<TValue> {
      return {
        filters: config.filters,
        valueSchema: config.valueSchema as Schema<TValue> | undefined,
        handler: handler as (request: KafkaRequest<TValue>) => Promise<void>,
      };
    },
  };
}

export class KafkaRouter implements EventTypeRouter<KafkaEvent, undefined | KafkaBatchResponse> {
  private routes: InternalRoute[] = [];
  private batchItemFailures: boolean;

  constructor(options?: KafkaRouterOptions) {
    this.batchItemFailures = options?.batchItemFailures ?? false;
  }

  canHandleEvent(event: unknown): event is KafkaEvent {
    if (!isObject(event)) return false;
    if (!isObject(event.records)) return false;

    const eventSource = event.eventSource;
    return eventSource === 'aws:kafka' || eventSource === 'SelfManagedKafka';
  }

  route<TValue>(definition: KafkaRouteDefinition<TValue>): this {
    this.routes.push(definition as InternalRoute);
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
      } catch {
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

    const route = this.matchRoute(record, event, decodedHeaders);
    if (!route) {
      throw new Error(`No route matched for record on topic ${record.topic} partition ${record.partition}`);
    }

    const key = Buffer.from(record.key, 'base64').toString('utf-8');
    const rawValue = Buffer.from(record.value, 'base64').toString('utf-8');
    const parsedValue = this.parseValue(rawValue);

    const validatedValue = this.validateValue(parsedValue, route.valueSchema, record);

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

    await route.handler(request);
  }

  private matchRoute(
    record: KafkaRecord,
    event: KafkaEvent,
    decodedHeaders: KafkaDecodedHeader[],
  ): InternalRoute | undefined {
    return this.routes.find((route) => {
      const { filters } = route;

      if (filters.topics && !filters.topics.includes(record.topic)) {
        return false;
      }

      if (filters.eventSourceArns) {
        if (!this.isMSKEvent(event)) {
          return false;
        }
        if (!filters.eventSourceArns.includes(event.eventSourceArn)) {
          return false;
        }
      }

      if (filters.bootstrapServers) {
        const eventServers = event.bootstrapServers.split(',');
        const hasMatchingServer = filters.bootstrapServers.some((server) => eventServers.includes(server));
        if (!hasMatchingServer) {
          return false;
        }
      }

      if (filters.customFilter) {
        return filters.customFilter({ headers: decodedHeaders, topic: record.topic, record });
      }

      return true;
    });
  }

  private parseValue(rawValue: string): unknown {
    try {
      return JSON.parse(rawValue);
    } catch {
      return rawValue;
    }
  }

  private validateValue(data: unknown, schema: Schema<unknown> | undefined, record: KafkaRecord): unknown {
    if (!schema) {
      return data;
    }

    const result = schema.safeParse(data);
    if (!result.success) {
      throw new Error(`Value validation failed for record on topic ${record.topic} partition ${record.partition}`);
    }
    return result.data;
  }
}

export function createKafkaRouter(options?: KafkaRouterOptions): KafkaRouter {
  return new KafkaRouter(options);
}
