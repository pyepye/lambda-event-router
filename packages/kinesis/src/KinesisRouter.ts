import type { EventTypeRouter } from '@lambda-event-router/base';
import { isObject, safeJsonParse, validateSchema } from '@lambda-event-router/base';
import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { Context, KinesisStreamBatchResponse, KinesisStreamEvent, KinesisStreamRecord } from 'aws-lambda';
import type { KinesisFilters, KinesisRequest, KinesisRouteDefinition, KinesisRouterOptions } from './types.js';

interface InternalRoute {
  filters: KinesisFilters;
  dataSchema?: StandardSchemaV1;
  handler: (request: KinesisRequest) => Promise<void>;
}

interface RouteInput<TDataSchema extends StandardSchemaV1 | undefined = undefined> {
  filters: KinesisFilters;
  dataSchema?: TDataSchema;
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
        handler: handler as (request: KinesisRequest<TData>) => Promise<void>,
      };
    },
  };
}

export class KinesisRouter implements EventTypeRouter<KinesisStreamEvent, undefined | KinesisStreamBatchResponse> {
  private routes: InternalRoute[] = [];
  private batchItemFailures: boolean;

  constructor(options?: KinesisRouterOptions) {
    this.batchItemFailures = options?.batchItemFailures ?? false;
  }

  canHandleEvent(event: unknown): event is KinesisStreamEvent {
    if (!isObject(event)) return false;
    if (!Array.isArray(event.Records)) return false;

    const firstRecord = event.Records[0];
    if (!isObject(firstRecord)) return false;

    return firstRecord.eventSource === 'aws:kinesis';
  }

  route<TData>(definition: KinesisRouteDefinition<TData>): this {
    this.routes.push(definition as InternalRoute);
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
      } catch {
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

    const route = this.matchRoute(record, data);
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

    await route.handler(request);
  }

  private matchRoute(record: KinesisStreamRecord, data: unknown): InternalRoute | undefined {
    return this.routes.find((route) => {
      const { filters } = route;

      if (filters.eventSourceArns && !filters.eventSourceArns.includes(record.eventSourceARN)) {
        return false;
      }

      if (filters.partitionKeys && !filters.partitionKeys.includes(record.kinesis.partitionKey)) {
        return false;
      }

      if (filters.customFilter) {
        return filters.customFilter({ data, partitionKey: record.kinesis.partitionKey, record });
      }

      return true;
    });
  }
}

export function createKinesisRouter(options?: KinesisRouterOptions): KinesisRouter {
  return new KinesisRouter(options);
}
