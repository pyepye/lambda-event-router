import type { AuthPreset, CorsConfig, DefineRouteFn } from '@lambda-event-router/http';
import { createDefineRoute, HTTPRouter } from '@lambda-event-router/http';

import { type APIGatewayEvent, type APIGatewayResult, apiGatewayAdapter } from './apiGatewayAdapter.js';
import type { APIGatewayAuth } from './auth.js';
import type { HTTPMiddleware } from './types.js';

type RawAuth = APIGatewayAuth;

export interface APIGatewayRouterOptions<TDefaultAuth extends RawAuth = RawAuth> {
  auth?: AuthPreset<RawAuth, TDefaultAuth>;
  middleware?: HTTPMiddleware[];
  cors?: CorsConfig;
}

export class APIGatewayRouter<TDefaultAuth extends RawAuth = RawAuth> extends HTTPRouter<
  APIGatewayEvent,
  APIGatewayResult,
  RawAuth,
  TDefaultAuth
> {
  constructor(options?: APIGatewayRouterOptions<TDefaultAuth>) {
    super({ adapter: apiGatewayAdapter, auth: options?.auth, middleware: options?.middleware, cors: options?.cors });
  }
}

export function createAPIGatewayRouter<TDefaultAuth extends RawAuth = RawAuth>(
  options?: APIGatewayRouterOptions<TDefaultAuth>,
): APIGatewayRouter<TDefaultAuth> {
  return new APIGatewayRouter(options);
}

export const defineRoute: DefineRouteFn<RawAuth> = createDefineRoute<RawAuth>();
