import type { Context, Handler } from 'aws-lambda';
import type { EventTypeRouter } from './types.js';

export class EventRouter {
  private routers: EventTypeRouter[];

  constructor(options: { routers: EventTypeRouter[] }) {
    // EventBridgeRouter is a catch-all, so it must be checked last
    const catchAllRouters = options.routers.filter((r) => r.constructor.name === 'EventBridgeRouter');
    const specificRouters = options.routers.filter((r) => r.constructor.name !== 'EventBridgeRouter');
    this.routers = [...specificRouters, ...catchAllRouters];
  }

  handler(): Handler {
    return async (event: unknown, context: Context): Promise<unknown> => {
      for (const router of this.routers) {
        if (router.canHandleEvent(event)) {
          // TODO: Add an error type stating that an router had no handler for an event. If we see this error here
          //       we can catch it and then move to the next router. This means we could have multiple routers
          //       of the same type, which could be useful to for having different routers for different use cases.
          //       E.g. Have a APIRouter one which supports unauthenticed paths and another authenticated or one
          //            that has specific CORS settings or middleware and an other that doesn't.
          return router.handleEvent(event, context);
        }
      }
      throw new Error('No router found for event');
    };
  }
}

export function createEventRouter(options: { routers: EventTypeRouter[] }): EventRouter {
  return new EventRouter(options);
}
