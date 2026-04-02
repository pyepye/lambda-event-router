import type { HTTPMiddleware } from '@lambda-event-router/http';
import { HTTPRouter } from '@lambda-event-router/http';
import type { ALBEvent, ALBResult } from 'aws-lambda';
import { albAdapter } from './albAdapter.js';

interface ALBRouterOptions {
  middleware?: HTTPMiddleware[];
}

export class ALBRouter extends HTTPRouter<ALBEvent, ALBResult> {
  constructor(options?: ALBRouterOptions) {
    super({ adapter: albAdapter, middleware: options?.middleware });
  }
}

export function createALBRouter(options?: ALBRouterOptions): ALBRouter {
  return new ALBRouter(options);
}
