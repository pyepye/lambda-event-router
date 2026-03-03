import { EventRouter } from '@lambda-event-router/base';
import { createFirehoseRouter } from '@lambda-event-router/firehose';
import type { Handler } from 'aws-lambda';

import { enrichRoute } from './handlers/enrichRoute.js';
import { filterRoute } from './handlers/filterRoute.js';
import { formatRoute } from './handlers/formatRoute.js';

const firehoseRouter = createFirehoseRouter();

firehoseRouter.route(enrichRoute).route(filterRoute).route(formatRoute);

const eventRouter = new EventRouter({
  routers: [firehoseRouter],
});

export const handler: Handler = eventRouter.handler();
