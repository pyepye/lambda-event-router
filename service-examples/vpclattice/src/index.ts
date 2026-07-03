import { LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { inventoryRouter } from './inventoryRouter.js';

const lambdaRouter = new LambdaRouter({ routers: [inventoryRouter] });

export const handler: Handler = lambdaRouter.handler();
