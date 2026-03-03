import { EventRouter } from '@lambda-event-router/base';
import { createSESRouter } from '@lambda-event-router/ses';
import type { Handler } from 'aws-lambda';

import {
  attachmentEmailRoute,
  inboundEmailRoute,
  internalEmailRoute,
  partnerEmailRoute,
} from './handlers/processEmailRoute.js';

const sesRouter = createSESRouter();

sesRouter.route(inboundEmailRoute).route(partnerEmailRoute).route(internalEmailRoute).route(attachmentEmailRoute);

const eventRouter = new EventRouter({
  routers: [sesRouter],
});

export const handler: Handler = eventRouter.handler();
