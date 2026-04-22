import type {
  Context,
  FirehoseTransformationEvent,
  FirehoseTransformationEventRecord,
  FirehoseTransformationResult,
  FirehoseTransformationResultRecord,
} from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { EventTypeRouter } from '@lambda-event-router/base';
import { handleEventWithMiddleware, isObject, safeJsonParse, validateSchema } from '@lambda-event-router/base';

import type { FirehoseResponseResult } from './response.js';
import { isFirehoseResponse } from './response.js';
import type {
  FirehoseFilters,
  FirehoseMiddleware,
  FirehoseRequest,
  FirehoseResponse,
  FirehoseRouteDefinition,
  FirehoseRouterOptions,
} from './types.js';

interface InternalRoute {
  filters: FirehoseFilters;
  dataSchema?: StandardSchemaV1;
  middleware?: FirehoseMiddleware[];
  handler: (request: FirehoseRequest) => Promise<FirehoseResponse>;
}

interface RouteInput<TDataSchema extends StandardSchemaV1 | undefined = undefined> {
  filters: FirehoseFilters;
  middleware?: FirehoseMiddleware[];
  dataSchema?: TDataSchema;
}

interface RouteBuilder<TData> {
  handle(handler: (request: FirehoseRequest<TData>) => Promise<FirehoseResponse>): FirehoseRouteDefinition<TData>;
}

export function defineRoute<
  TDataSchema extends StandardSchemaV1 | undefined = undefined,
  TData = TDataSchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TDataSchema> : unknown,
>(config: RouteInput<TDataSchema>): RouteBuilder<TData> {
  return {
    handle(handler: (request: FirehoseRequest<TData>) => Promise<FirehoseResponse>): FirehoseRouteDefinition<TData> {
      return {
        filters: config.filters as FirehoseFilters,
        dataSchema: config.dataSchema as StandardSchemaV1<unknown, TData> | undefined,
        middleware: config.middleware,
        handler: handler as (request: FirehoseRequest<TData>) => Promise<FirehoseResponse>,
      };
    },
  };
}

export class FirehoseRouter implements EventTypeRouter<FirehoseTransformationEvent, FirehoseTransformationResult> {
  private routes: InternalRoute[] = [];
  private middleware: FirehoseMiddleware[] = [];

  constructor(options?: FirehoseRouterOptions) {
    this.middleware = options?.middleware ?? [];
  }

  canHandleEvent(event: unknown): event is FirehoseTransformationEvent {
    if (!isObject(event)) return false;
    if (typeof event.deliveryStreamArn !== 'string') return false;
    if (!Array.isArray(event.records)) return false;

    const firstRecord = event.records[0];
    if (!isObject(firstRecord)) return false;

    return typeof firstRecord.recordId === 'string';
  }

  route<TData>(definition: FirehoseRouteDefinition<TData>): this {
    this.routes.push(definition as InternalRoute);
    return this;
  }

  async handleEvent(event: FirehoseTransformationEvent, context: Context): Promise<FirehoseTransformationResult> {
    const resultRecords: FirehoseTransformationResultRecord[] = [];

    for (const record of event.records) {
      const resultRecord = await this.processRecord(record, event, context);
      resultRecords.push(resultRecord);
    }

    return { records: resultRecords };
  }

  private async processRecord(
    record: FirehoseTransformationEventRecord,
    event: FirehoseTransformationEvent,
    context: Context,
  ): Promise<FirehoseTransformationResultRecord> {
    try {
      const rawData = Buffer.from(record.data, 'base64').toString('utf-8');
      const data = safeJsonParse(rawData);

      const route = await this.matchRoute(event, record, data);
      if (!route) {
        return { recordId: record.recordId, result: 'ProcessingFailed', data: record.data };
      }

      const validatedData = await validateSchema(
        data,
        route.dataSchema,
        `Data validation failed for record ${record.recordId}`,
      );

      const request: FirehoseRequest = {
        data: validatedData,
        recordId: record.recordId,
        approximateArrivalTimestamp: record.approximateArrivalTimestamp,
        record,
        context,
        metadata: record.kinesisRecordMetadata,
      };

      const allMiddleware = [...this.middleware, ...(route.middleware ?? [])];
      const response = await handleEventWithMiddleware(allMiddleware, request, route.handler);
      return this.mapResponseToResult(record, response);
    } catch (error: unknown) {
      if (isFirehoseResponse(error)) {
        return this.mapResponseToResult(record, error);
      }
      return { recordId: record.recordId, result: 'ProcessingFailed', data: record.data };
    }
  }

  private mapResponseToResult(
    record: FirehoseTransformationEventRecord,
    response: FirehoseResponseResult,
  ): FirehoseTransformationResultRecord {
    if (response.status === 'ProcessingFailed') {
      return { recordId: record.recordId, result: 'ProcessingFailed', data: record.data };
    }

    if (response.status === 'Dropped') {
      return { recordId: record.recordId, result: 'Dropped', data: record.data };
    }

    if (response.data) {
      return {
        recordId: record.recordId,
        result: 'Ok',
        data: response.data,
        metadata: response.metadata,
      };
    }

    return {
      recordId: record.recordId,
      result: 'Ok',
      data: record.data,
      metadata: response.metadata,
    };
  }

  private async matchRoute(
    event: FirehoseTransformationEvent,
    record: FirehoseTransformationEventRecord,
    data: unknown,
  ): Promise<InternalRoute | undefined> {
    for (const route of this.routes) {
      const { filters } = route;

      if (filters.deliveryStreamArn) {
        const { deliveryStreamArn: filterStreamArn } = filters;
        const deliveryStreamArns = Array.isArray(filterStreamArn) ? filterStreamArn : [filterStreamArn];
        if (!deliveryStreamArns.includes(event.deliveryStreamArn)) {
          continue;
        }
      }

      if (filters.sourceKinesisStreamArn) {
        const { sourceKinesisStreamArn: filterKinesisArn } = filters;
        const sourceKinesisStreamArns = Array.isArray(filterKinesisArn) ? filterKinesisArn : [filterKinesisArn];
        if (!event.sourceKinesisStreamArn) continue;
        if (!sourceKinesisStreamArns.includes(event.sourceKinesisStreamArn)) continue;
      }

      if (filters.customFilter) {
        const match = await filters.customFilter({
          data,
          recordId: record.recordId,
          approximateArrivalTimestamp: record.approximateArrivalTimestamp,
          record,
          metadata: record.kinesisRecordMetadata,
        });
        if (!match) continue;
      }

      return route;
    }

    return undefined;
  }
}

export function createFirehoseRouter(options?: FirehoseRouterOptions): FirehoseRouter {
  return new FirehoseRouter(options);
}
