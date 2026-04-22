import type { HTTPMiddleware } from '@lambda-event-router/http';
import { HTTPRouter } from '@lambda-event-router/http';

import { type APIGatewayEvent, type APIGatewayResult, apiGatewayAdapter } from './apiGatewayAdapter.js';

interface APIGatewayRouterOptions {
  middleware?: HTTPMiddleware[];
}

export class APIGatewayRouter extends HTTPRouter<APIGatewayEvent, APIGatewayResult> {
  constructor(options?: APIGatewayRouterOptions) {
    super({ adapter: apiGatewayAdapter, middleware: options?.middleware });
  }
}

export function createAPIGatewayRouter(options?: APIGatewayRouterOptions): APIGatewayRouter {
  return new APIGatewayRouter(options);
}
