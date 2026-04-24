import type { Context, KinesisStreamBatchResponse, KinesisStreamEvent, KinesisStreamRecord } from 'aws-lambda';

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

import type { KinesisFilters, KinesisRequest, KinesisRouteDefinition, KinesisRouterOptions } from './types.js';

interface InternalRoute {
  filters: KinesisFilters;
  dataSchema?: StandardSchemaV1;
  middleware: Middleware<KinesisRequest, void>[];
  handler: (request: KinesisRequest) => Promise<void>;
}

interface RouteInput<TDataSchema extends StandardSchemaV1 | undefined = undefined> {
  filters: KinesisFilters;
  dataSchema?: TDataSchema;
  middleware?: Middleware<KinesisRequest, void>[];
}

interface RouteBuilder<TData> {
  handle(handler: (request: KinesisRequest<TData>) => Promise<void>): KinesisRouteDefinition<TData>;
}

export function defineRoute<
  TDataSchema extends StandardSchemaV1 | undefined = undefined,
  TData = TDataSchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TDataSchema> : unknown,
>(config: RouteInput<TDataSchema>): RouteBuilder<TData> {
  return {
    handle(handler: (request: KinesisRequest<TData>) => Promise<void>): KinesisRouteDefinition<TData> {
      return {
        filters: config.filters as KinesisFilters,
        dataSchema: config.dataSchema as StandardSchemaV1<unknown, TData> | undefined,
        middleware: config.middleware as KinesisRouteDefinition<TData>['middleware'],
        handler: handler as (request: KinesisRequest<TData>) => Promise<void>,
      };
    },
  };
}

export class KinesisRouter implements EventTypeRouter<KinesisStreamEvent, undefined | KinesisStreamBatchResponse> {
  private routes: InternalRoute[] = [];
  private batchItemFailures: boolean;
  private middleware: Middleware<KinesisRequest, void>[];

  constructor(options?: KinesisRouterOptions) {
    this.batchItemFailures = options?.batchItemFailures ?? false;
    this.middleware = options?.middleware ?? [];
  }

  canHandleEvent(event: unknown): event is KinesisStreamEvent {
    if (!isObject(event)) return false;
    if (!Array.isArray(event.Records)) return false;

    const firstRecord = event.Records[0];
    if (!isObject(firstRecord)) return false;

    return firstRecord.eventSource === 'aws:kinesis';
  }

  route<TData>(definition: KinesisRouteDefinition<TData>): this {
    this.routes.push({
      filters: definition.filters,
      dataSchema: definition.dataSchema,
      // @ts-expect-error Contravariance: typed middleware stored in general InternalRoute, safe because schema validates before calling
      middleware: definition.middleware ?? [],
      // @ts-expect-error Contravariance: typed handler stored in general InternalRoute, safe because schema validates before calling
      handler: definition.handler,
    });
    return this;
  }

  async handleEvent(event: KinesisStreamEvent, context: Context): Promise<undefined | KinesisStreamBatchResponse> {
    if (!this.batchItemFailures) {
      await this.processRecordsSequentially(event.Records, context);
      return;
    }

    const batchItemFailures = await this.processRecordsWithFailures(event.Records, context);
    if (batchItemFailures.length > 0) {
      return { batchItemFailures };
    }
  }

  private async processRecordsSequentially(records: KinesisStreamRecord[], context: Context): Promise<void> {
    for (const record of records) {
      await this.processRecord(record, context);
    }
  }

  private async processRecordsWithFailures(
    records: KinesisStreamRecord[],
    context: Context,
  ): Promise<KinesisStreamBatchResponse['batchItemFailures']> {
    const failures: KinesisStreamBatchResponse['batchItemFailures'] = [];

    for (const [idx, record] of records.entries()) {
      try {
        await this.processRecord(record, context);
      } catch (error) {
        logger.error(`Error processing Kinesis record ${record.eventID}`, { error });
        for (const remaining of records.slice(idx)) {
          failures.push({ itemIdentifier: remaining.eventID });
        }
        break;
      }
    }
    return failures;
  }

  private async processRecord(record: KinesisStreamRecord, context: Context): Promise<void> {
    const rawData = Buffer.from(record.kinesis.data, 'base64').toString('utf-8');
    const data = safeJsonParse(rawData);

    const route = await this.matchRoute(record, data);
    if (!route) {
      throw new Error(`No route matched for record ${record.eventID} from ${record.eventSourceARN}`);
    }

    const validationErrorMessage = `Data validation failed for record ${record.eventID}`;
    const validatedData = await validateSchema(data, route.dataSchema, validationErrorMessage);

    const request: KinesisRequest = {
      data: validatedData,
      partitionKey: record.kinesis.partitionKey,
      sequenceNumber: record.kinesis.sequenceNumber,
      approximateArrivalTimestamp: record.kinesis.approximateArrivalTimestamp,
      record,
      context,
    };

    const allMiddleware = [...this.middleware, ...route.middleware];
    await handleEventWithMiddleware(allMiddleware, request, route.handler);
  }

  private async matchRoute(record: KinesisStreamRecord, data: unknown): Promise<InternalRoute | undefined> {
    for (const route of this.routes) {
      const { filters } = route;

      if (filters.eventSourceArn) {
        const eventSourceArnMatch = filterStringMatcher(record.eventSourceARN, filters.eventSourceArn);
        if (!eventSourceArnMatch) continue;
      }

      if (filters.partitionKey) {
        const partitionKeyMatch = filterStringMatcher(record.kinesis.partitionKey, filters.partitionKey);
        if (!partitionKeyMatch) continue;
      }

      if (filters.customFilter) {
        const match = await filters.customFilter({ data, partitionKey: record.kinesis.partitionKey, record });
        if (!match) continue;
      }

      return route;
    }

    return undefined;
  }
}

export function createKinesisRouter(options?: KinesisRouterOptions): KinesisRouter {
  return new KinesisRouter(options);
}
