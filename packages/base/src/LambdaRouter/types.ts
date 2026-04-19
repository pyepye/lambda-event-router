import type { Context } from 'aws-lambda';

export interface EventTypeRouter<TEvent = unknown, TResult = unknown> {
  canHandleEvent(event: unknown): boolean | Promise<boolean>;
  handleEvent(event: TEvent, context: Context): Promise<TResult>;
}
