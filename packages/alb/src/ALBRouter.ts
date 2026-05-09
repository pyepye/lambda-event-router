import type { ALBEvent, ALBResult } from 'aws-lambda';

import type { CorsConfig, HTTPMiddleware } from '@lambda-event-router/http';
import { HTTPRouter } from '@lambda-event-router/http';

import { albAdapter } from './albAdapter.js';

interface ALBRouterOptions {
  middleware?: HTTPMiddleware[];
  cors?: CorsConfig;
}

export class ALBRouter extends HTTPRouter<ALBEvent, ALBResult> {
  constructor(options?: ALBRouterOptions) {
    super({ adapter: albAdapter, middleware: options?.middleware, cors: options?.cors });
  }
}

export function createALBRouter(options?: ALBRouterOptions): ALBRouter {
  return new ALBRouter(options);
}
