import type { Context } from 'aws-lambda';

export interface EventTypeMatcher<TEvent = unknown, TResult = unknown> {
  canHandleEvent(event: unknown): boolean | Promise<boolean>;
  handleEvent(event: TEvent, context: Context): Promise<TResult>;
  readonly matchTier?: 'catchAll' | 'fallback'; // Hack so custom envelope matchers with wide matchers go last
}
