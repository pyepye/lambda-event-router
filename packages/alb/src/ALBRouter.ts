import type { ALBEvent, ALBResult } from 'aws-lambda';

import type { CorsConfig, DefineRouteFn } from '@lambda-event-router/http';
import { createDefineRoute, HTTPRouter } from '@lambda-event-router/http';

import { albAdapter } from './albAdapter.js';
import type { HTTPMiddleware } from './types.js';

export interface ALBRouterOptions {
  middleware?: HTTPMiddleware[];
  cors?: CorsConfig;
}

export class ALBRouter extends HTTPRouter<ALBEvent, ALBResult, undefined> {
  constructor(options?: ALBRouterOptions) {
    super({ adapter: albAdapter, middleware: options?.middleware, cors: options?.cors });
  }
}

export function createALBRouter(options?: ALBRouterOptions): ALBRouter {
  return new ALBRouter(options);
}

export const defineRoute: DefineRouteFn<undefined> = createDefineRoute<undefined>();
