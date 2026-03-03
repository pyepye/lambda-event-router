import { EventRouter } from '@lambda-event-router/base';
import { createFirehoseRouter, type FirehoseFilterInput } from '@lambda-event-router/firehose';
import type { Handler } from 'aws-lambda';

import { handleErrorLog } from './handlers/errorLogHandler.js';
import { handleKinesisSource, InventoryDataSchema } from './handlers/kinesisSourceHandler.js';
import { LogDataSchema, transformLog } from './handlers/transformHandler.js';

const firehoseRouter = createFirehoseRouter();

const DELIVERY_STREAM_ARN = 'arn:aws:firehose:us-east-1:123456789012:deliverystream/log-delivery';

const INVENTORY_KINESIS_STREAM_ARN = 'arn:aws:kinesis:us-east-1:123456789012:stream/inventory-events';

// Route with deliveryStreamArns filter — transforms general logs
firehoseRouter.route({
  filters: {
    deliveryStreamArns: [DELIVERY_STREAM_ARN],
  },
  handler: transformLog,
  dataSchema: LogDataSchema,
});

// data is unknown (decoded but not schema-validated) — narrow before accessing properties
function isErrorLog({ data }: FirehoseFilterInput): boolean {
  if (typeof data !== 'object' || data === null) return false;
  if (!('level' in data) || typeof data.level !== 'string') return false;
  return data.level === 'ERROR';
}

// Route with custom filter — routes error logs to a dedicated handler
firehoseRouter.route({
  filters: {
    deliveryStreamArns: [DELIVERY_STREAM_ARN],
    customFilter: isErrorLog,
  },
  handler: handleErrorLog,
  dataSchema: LogDataSchema,
});

// Route with sourceKinesisStreamArns filter — handles Kinesis-sourced inventory data
firehoseRouter.route({
  filters: {
    sourceKinesisStreamArns: [INVENTORY_KINESIS_STREAM_ARN],
  },
  handler: handleKinesisSource,
  dataSchema: InventoryDataSchema,
});

const eventRouter = new EventRouter({
  routers: [firehoseRouter],
});

export const handler: Handler = eventRouter.handler();
