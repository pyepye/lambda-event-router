import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { eventsRouter } from './eventsRouter.js';
import { resolverRouter } from './resolverRouter.js';

const lambdaRouter = new LambdaRouter({ routers: [resolverRouter, eventsRouter] });

export const handler: Handler = lambdaRouter.handler();
