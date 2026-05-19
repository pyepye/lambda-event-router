import type { Handler } from 'aws-lambda';

import { LambdaRouter } from '@lambda-event-router/base';
import { createKinesisRouter, type KinesisFilterInput } from '@lambda-event-router/kinesis';

import { OrderDataSchema, processOrder } from './handlers/orderHandler.js';

const kinesisRouter = createKinesisRouter({
  batchItemFailures: true, // defaults to false as that is the AWS default
});

const ORDER_STREAM_ARN = 'arn:aws:kinesis:us-east-1:123456789012:stream/order-events';

// Route with eventSourceArns filter
kinesisRouter.route({
  filters: {
    eventSourceArn: ORDER_STREAM_ARN,
  },
  handler: processOrder,
  dataSchema: OrderDataSchema,
});

// Route with partitionKeys filter
kinesisRouter.route({
  filters: {
    partitionKey: ['orders-us-east', 'orders-us-west'],
  },
  handler: processOrder,
  dataSchema: OrderDataSchema,
});

// data is unknown (decoded but not schema-validated) - narrow before accessing properties
function isLargeOrder({ data }: KinesisFilterInput): boolean {
  if (typeof data !== 'object' || data === null) return false;
  if (!('total' in data) || typeof data.total !== 'number') return false;
  return data.total > 1000;
}

kinesisRouter.route({
  filters: {
    eventSourceArn: ORDER_STREAM_ARN,
    custom: isLargeOrder,
  },
  handler: processOrder,
  dataSchema: OrderDataSchema,
});

const lambdaRouter = new LambdaRouter({
  routers: [kinesisRouter],
});

export const handler: Handler = lambdaRouter.handler();
