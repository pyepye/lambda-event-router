import { EventRouter } from '@lambda-event-router/base';
import { createKafkaRouter } from '@lambda-event-router/kafka';
import type { Handler } from 'aws-lambda';

import { auditRoute } from './handlers/auditRoute.js';
import { notificationRoute } from './handlers/notificationRoute.js';
import { orderRoute } from './handlers/orderRoute.js';

const kafkaRouter = createKafkaRouter({
  batchItemFailures: true,
});

kafkaRouter.route(orderRoute).route(notificationRoute).route(auditRoute);

const eventRouter = new EventRouter({
  routers: [kafkaRouter],
});

export const handler: Handler = eventRouter.handler();
