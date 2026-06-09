import type { ALBEvent, ALBResult } from 'aws-lambda';

import type { ContentType, CorsConfig, HTTPErrorHandler, HTTPMiddleware } from '@lambda-event-router/http';
import { HTTPRouter } from '@lambda-event-router/http';

import { albAdapter } from './albAdapter.js';

export interface ALBRouterOptions {
  middleware?: HTTPMiddleware[];
  cors?: CorsConfig;
  contentType?: ContentType;
  onError?: HTTPErrorHandler;
}

export class ALBRouter extends HTTPRouter<ALBEvent, ALBResult> {
  constructor(options?: ALBRouterOptions) {
    super({
      adapter: albAdapter,
      middleware: options?.middleware,
      cors: options?.cors,
      contentType: options?.contentType,
      onError: options?.onError,
    });
  }
}

export function createALBRouter(options?: ALBRouterOptions): ALBRouter {
  return new ALBRouter(options);
}
