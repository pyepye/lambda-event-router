import type { Handler } from 'aws-lambda';

import { LambdaRouter } from '@lambda-event-router/base';
import { createFirehoseRouter } from '@lambda-event-router/firehose';

import { handleErrorLog, isErrorLog } from './handlers/errorLogHandler.js';
import { handleKinesisSource, InventoryDataSchema } from './handlers/kinesisSourceHandler.js';
import { LogDataSchema, transformLog } from './handlers/transformHandler.js';

const firehoseRouter = createFirehoseRouter();

const DELIVERY_STREAM_ARN = 'arn:aws:firehose:us-east-1:123456789012:deliverystream/log-delivery';

const INVENTORY_KINESIS_STREAM_ARN = 'arn:aws:kinesis:us-east-1:123456789012:stream/inventory-events';

// Route with deliveryStreamArns filter - transforms general logs
firehoseRouter.route({
  filters: {
    deliveryStreamArn: DELIVERY_STREAM_ARN,
  },
  handler: transformLog,
  dataSchema: LogDataSchema,
});

// Route with custom filter - routes error logs to a dedicated handler
firehoseRouter.route({
  filters: {
    deliveryStreamArn: DELIVERY_STREAM_ARN,
    customFilter: isErrorLog,
  },
  handler: handleErrorLog,
  dataSchema: LogDataSchema,
});

// Route with sourceKinesisStreamArns filter - handles Kinesis-sourced inventory data
firehoseRouter.route({
  filters: {
    sourceKinesisStreamArn: INVENTORY_KINESIS_STREAM_ARN,
  },
  handler: handleKinesisSource,
  dataSchema: InventoryDataSchema,
});

const lambdaRouter = new LambdaRouter({
  routers: [firehoseRouter],
});

export const handler: Handler = lambdaRouter.handler();
