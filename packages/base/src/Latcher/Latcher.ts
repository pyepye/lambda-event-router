import type { Context, Handler } from 'aws-lambda';

import { NoRouteMatchedError } from '../errors';
import { logger as log } from '../logger';
import type { EventTypeMatcher } from './types.js';

export interface LatcherOptions {
  matchers: EventTypeMatcher[];
  middleware?: LambdaMiddleware[];
}

export type LambdaMiddleware = (
  event: unknown,
  context: Context,
  next: (event: unknown, context: Context) => Promise<unknown>,
) => Promise<unknown>;

export class Latcher {
  private matchers: EventTypeMatcher[];
  private middleware: LambdaMiddleware[];

  constructor(options: LatcherOptions) {
    // Hack: Ordering so StepFunctionMatcher then EventMatcher are called last via matchTier. This is so matchers that deal
    // with custom payloads try to handle events last as they could accidentally match other service specific events.
    const specificMatchers = options.matchers.filter((r) => !r.matchTier);
    const catchAllMatchers = options.matchers.filter((r) => r.matchTier === 'catchAll');
    const fallbackMatchers = options.matchers.filter((r) => r.matchTier === 'fallback');
    this.matchers = [...specificMatchers, ...catchAllMatchers, ...fallbackMatchers];
    this.middleware = options.middleware ?? [];
    log.debug(`Latcher middleware (${this.middleware.length}) ${this.middleware.map((m) => m.name)}`);
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

    for (const matcher of this.matchers) {
      const canHandleEvent = await matcher.canHandleEvent(event);
      if (!canHandleEvent) continue;

      try {
        return await matcher.handleEvent(event, context);
      } catch (error) {
        // Only a no-route miss may fall through to the next matcher. Anything else, a failing schema
        // included, fails the invocation.
        if (!NoRouteMatchedError.isNoRouteMatchedError(error)) throw error;
        noRouteMatchedError = error;
      }
    }

    // Rethrow the matcher's own error so a single claiming matcher reports its own miss.
    if (noRouteMatchedError) throw noRouteMatchedError;
    throw new Error('No matcher found for event');
  }
}

export function createLatcher(options: LatcherOptions): Latcher {
  return new Latcher(options);
}
