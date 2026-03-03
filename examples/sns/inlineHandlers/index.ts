import { EventRouter } from '@lambda-event-router/base';
import { createSNSRouter } from '@lambda-event-router/sns';
import type { Handler } from 'aws-lambda';

import { createItemRoute, urgentNotificationRoute } from './createItem.js';

const snsRouter = createSNSRouter(); // Defaults to batchItemFailures: false

snsRouter.route(createItemRoute).route(urgentNotificationRoute);

const eventRouter = new EventRouter({
  routers: [snsRouter],
});

export const handler: Handler = eventRouter.handler();
