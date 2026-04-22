import type { Handler } from 'aws-lambda';

import { LambdaRouter } from '@lambda-event-router/base';
import { createSESRouter } from '@lambda-event-router/ses';

import {
  attachmentEmailRoute,
  inboundEmailRoute,
  internalEmailRoute,
  partnerEmailRoute,
} from './handlers/processEmailRoute.js';

const sesRouter = createSESRouter();

sesRouter.route(inboundEmailRoute).route(partnerEmailRoute).route(internalEmailRoute).route(attachmentEmailRoute);

const lambdaRouter = new LambdaRouter({
  routers: [sesRouter],
});

export const handler: Handler = lambdaRouter.handler();
