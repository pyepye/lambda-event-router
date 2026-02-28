import { EventRouter } from '@lambda-event-router/base';
import { createKafkaRouter, type KafkaFilterInput } from '@lambda-event-router/kafka';
import type { Handler } from 'aws-lambda';

import { OrderValueSchema, processOrder } from './handlers/orderHandler.js';

const kafkaRouter = createKafkaRouter({
  batchItemFailures: true,
});

const MSK_CLUSTER_ARN = 'arn:aws:kafka:us-east-1:123456789012:cluster/my-cluster/abc-123';
const ORDERS_TOPIC = 'orders';

kafkaRouter.route({
  filters: {
    topics: [ORDERS_TOPIC],
    eventSourceArns: [MSK_CLUSTER_ARN],
  },
  handler: processOrder,
  valueSchema: OrderValueSchema,
});

// Route with bootstrapServers filter (for self-managed Kafka)
const BOOTSTRAP_SERVERS = 'kafka-broker-1.example.com:9092';

kafkaRouter.route({
  filters: {
    topics: [ORDERS_TOPIC],
    bootstrapServers: [BOOTSTRAP_SERVERS],
  },
  handler: processOrder,
  valueSchema: OrderValueSchema,
});

// Route with custom filter on headers
function hasCorrelationId({ headers }: KafkaFilterInput): boolean {
  return headers.some((header) => Object.hasOwn(header, 'correlationId'));
}

kafkaRouter.route({
  filters: {
    topics: [ORDERS_TOPIC],
    customFilter: hasCorrelationId,
  },
  handler: processOrder,
  valueSchema: OrderValueSchema,
});

const eventRouter = new EventRouter({
  routers: [kafkaRouter],
});

export const handler: Handler = eventRouter.handler();
