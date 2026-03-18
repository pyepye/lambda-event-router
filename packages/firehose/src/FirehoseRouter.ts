import type { EventTypeRouter, InferSchema, Schema } from '@lambda-event-router/base';
import { isObject } from '@lambda-event-router/base';
import type {
  Context,
  FirehoseTransformationEvent,
  FirehoseTransformationEventRecord,
  FirehoseTransformationResult,
  FirehoseTransformationResultRecord,
} from 'aws-lambda';
import type { FirehoseResponseResult } from './response.js';
import { isFirehoseResponse } from './response.js';
import type { FirehoseFilters, FirehoseRequest, FirehoseResponse, FirehoseRouteDefinition } from './types.js';

interface InternalRoute {
  filters: FirehoseFilters;
  dataSchema?: Schema<unknown>;
  handler: (request: FirehoseRequest) => Promise<FirehoseResponse>;
}

interface RouteInput<TDataSchema extends Schema<unknown> | undefined = undefined> {
  filters: FirehoseFilters;
  dataSchema?: TDataSchema;
}

interface RouteBuilder<TData> {
  handle(handler: (request: FirehoseRequest<TData>) => Promise<FirehoseResponse>): FirehoseRouteDefinition<TData>;
}

export function defineRoute<
  TDataSchema extends Schema<unknown> | undefined = undefined,
  TData = TDataSchema extends Schema<unknown> ? InferSchema<TDataSchema> : unknown,
>(config: RouteInput<TDataSchema>): RouteBuilder<TData> {
  return {
    handle(handler: (request: FirehoseRequest<TData>) => Promise<FirehoseResponse>): FirehoseRouteDefinition<TData> {
      return {
        filters: config.filters as FirehoseFilters,
        dataSchema: config.dataSchema as Schema<TData> | undefined,
        handler: handler as (request: FirehoseRequest<TData>) => Promise<FirehoseResponse>,
      };
    },
  };
}

export class FirehoseRouter implements EventTypeRouter<FirehoseTransformationEvent, FirehoseTransformationResult> {
  private routes: InternalRoute[] = [];

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
      const data = this.parseData(rawData);

      const route = this.matchRoute(event, record, data);
      if (!route) {
        return { recordId: record.recordId, result: 'ProcessingFailed', data: record.data };
      }

      const validatedData = this.validateData(data, route.dataSchema, record);

      const request: FirehoseRequest = {
        data: validatedData,
        recordId: record.recordId,
        approximateArrivalTimestamp: record.approximateArrivalTimestamp,
        record,
        context,
        metadata: record.kinesisRecordMetadata,
      };

      const response = await route.handler(request);

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

  private matchRoute(
    event: FirehoseTransformationEvent,
    record: FirehoseTransformationEventRecord,
    data: unknown,
  ): InternalRoute | undefined {
    return this.routes.find((route) => {
      const { filters } = route;

      if (filters.deliveryStreamArns && !filters.deliveryStreamArns.includes(event.deliveryStreamArn)) {
        return false;
      }

      if (filters.sourceKinesisStreamArns) {
        if (!event.sourceKinesisStreamArn) return false;
        if (!filters.sourceKinesisStreamArns.includes(event.sourceKinesisStreamArn)) return false;
      }

      if (filters.customFilter) {
        return filters.customFilter({
          data,
          recordId: record.recordId,
          approximateArrivalTimestamp: record.approximateArrivalTimestamp,
          record,
          metadata: record.kinesisRecordMetadata,
        });
      }

      return true;
    });
  }

  private parseData(rawData: string): unknown {
    try {
      return JSON.parse(rawData);
    } catch {
      return rawData;
    }
  }

  private validateData(
    data: unknown,
    schema: Schema<unknown> | undefined,
    record: FirehoseTransformationEventRecord,
  ): unknown {
    if (!schema) {
      return data;
    }

    if (typeof data === 'string') {
      throw new Error(`Failed to parse JSON data for record ${record.recordId}`);
    }

    const result = schema.safeParse(data);
    if (!result.success) {
      throw new Error(`Data validation failed for record ${record.recordId}`);
    }
    return result.data;
  }
}

export function createFirehoseRouter(): FirehoseRouter {
  return new FirehoseRouter();
}
