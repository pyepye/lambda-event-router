import type { Context, Handler } from 'aws-lambda';

export interface EventTypeRouter<TEvent = unknown, TResult = unknown> {
  canHandleEvent(event: unknown): event is TEvent;
  handleEvent(event: TEvent, context: Context): Promise<TResult>;
}

export class EventRouter {
  private routers: EventTypeRouter[];

  constructor(options: { routers: EventTypeRouter[] }) {
    this.routers = options.routers;
  }

  handler(): Handler {
    return async (event, context): Promise<unknown> => {
      for (const router of this.routers) {
        if (router.canHandleEvent(event)) {
          // TODO: Add an error type stating that an router had no handler for an event. If we see this error here
          //       we can catch it and then move to the next router. This means we could have multiple routers
          //       of the same type, which could be userful to for having different routers for different use cases.
          //       E.g. Have a APIRouter one which supports unauthenticed paths and another authenticated or one
          //            that has specific CORS settings or middleware and an other that doesn't.
          return router.handleEvent(event, context);
        }
      }
      throw new Error('No router found for event');
    };
  }
}

export function createEventRouter(options: {
  routers: EventTypeRouter[];
}): EventRouter {
  return new EventRouter(options);
}
