import type { Context, Handler } from 'aws-lambda';

export interface EventTypeRouter<TEvent = unknown, TResult = unknown> {
  canHandle(event: unknown): event is TEvent;
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
        if (router.canHandle(event)) {
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
