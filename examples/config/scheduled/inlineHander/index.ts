import { EventRouter } from '@lambda-event-router/base';
import { createConfigScheduledRouter } from '@lambda-event-router/config';
import type { Handler } from 'aws-lambda';

import { crossAccountRoute, tagAuditRoute } from './routes.js';

const configScheduledRouter = createConfigScheduledRouter();

configScheduledRouter.route(tagAuditRoute).route(crossAccountRoute);

const eventRouter = new EventRouter({
  routers: [configScheduledRouter],
});

export const handler: Handler = eventRouter.handler();
