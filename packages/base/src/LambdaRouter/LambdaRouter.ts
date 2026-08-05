import type { Context, Handler } from 'aws-lambda';

import { NoRouteMatchedError } from '../errors';
import { logger as log } from '../logger';
import type { EventTypeRouter } from './types.js';

interface LambdaRouterOptions {
  routers: EventTypeRouter[];
  middleware?: LambdaMiddleware[];
}

type LambdaMiddleware = (
  event: unknown,
  context: Context,
  next: (event: unknown, context: Context) => Promise<unknown>,
) => Promise<unknown>;

export class LambdaRouter {
  private routers: EventTypeRouter[];
  private middleware: LambdaMiddleware[];

  constructor(options: LambdaRouterOptions) {
    // EventRouter accepts arbitrary JSON payloads, making its canHandleEvent a catch-all.
    // Always put it at the end so that it only handles events that no other router can handle.
    const customEnvelopeRouters = options.routers.filter((r) => r.constructor.name === 'EventRouter');
    const otherRouters = options.routers.filter((r) => r.constructor.name !== 'EventRouter');
    this.routers = [...otherRouters, ...customEnvelopeRouters];
    this.middleware = options.middleware ?? [];
    log.debug(`LambdaRouter middleware (${this.middleware.length}) ${this.middleware.map((m) => m.name)}`);
  }

  handler(): Handler {
    return async (event: unknown, context: Context): Promise<unknown> => {
      // Clear any temporary logger keys left behind by the previous invocation in this container.
      log.resetKeys();
      return this.handleEventWithMiddleware(event, context, (evt, ctx) => this.handleEvent(evt, ctx));
    };
  }

  private async handleEventWithMiddleware(
    event: unknown,
    context: Context,
    handler: (event: unknown, context: Context) => Promise<unknown>,
  ): Promise<unknown> {
    let index = 0;

    const next = async (evt: unknown, ctx: Context): Promise<unknown> => {
      const currentMiddleware = this.middleware[index];
      if (currentMiddleware) {
        index++;
        return currentMiddleware(evt, ctx, next);
      }
      return handler(evt, ctx);
    };

    return next(event, context);
  }

  private async handleEvent(event: unknown, context: Context): Promise<unknown> {
    let noRouteMatchedError: NoRouteMatchedError | undefined;

    for (const router of this.routers) {
      const canHandleEvent = await router.canHandleEvent(event);
      if (!canHandleEvent) continue;

      try {
        return await router.handleEvent(event, context);
      } catch (error) {
        // Only a no-route miss may fall through to the next router. Anything else, a failing schema
        // included, fails the invocation.
        if (!NoRouteMatchedError.isNoRouteMatchedError(error)) throw error;
        noRouteMatchedError = error;
      }
    }

    // Rethrow the router's own error so a single claiming router reports its own miss.
    if (noRouteMatchedError) throw noRouteMatchedError;
    throw new Error('No router found for event');
  }
}

export function createLambdaRouter(options: LambdaRouterOptions): LambdaRouter {
  return new LambdaRouter(options);
}
