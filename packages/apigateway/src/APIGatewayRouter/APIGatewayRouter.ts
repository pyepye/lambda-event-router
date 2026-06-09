import type { ContentType, CorsConfig, HTTPErrorHandler, HTTPMiddleware } from '@lambda-event-router/http';
import { HTTPRouter } from '@lambda-event-router/http';

import { type APIGatewayEvent, type APIGatewayResult, apiGatewayAdapter } from './apiGatewayAdapter.js';

export interface APIGatewayRouterOptions {
  middleware?: HTTPMiddleware[];
  cors?: CorsConfig;
  contentType?: ContentType;
  onError?: HTTPErrorHandler;
}

export class APIGatewayRouter extends HTTPRouter<APIGatewayEvent, APIGatewayResult> {
  constructor(options?: APIGatewayRouterOptions) {
    super({
      adapter: apiGatewayAdapter,
      middleware: options?.middleware,
      cors: options?.cors,
      contentType: options?.contentType,
      onError: options?.onError,
    });
  }
}

export function createAPIGatewayRouter(options?: APIGatewayRouterOptions): APIGatewayRouter {
  return new APIGatewayRouter(options);
}
