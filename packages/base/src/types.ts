import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { Context } from 'aws-lambda';

export interface EventTypeRouter<TEvent = unknown, TResult = unknown> {
  canHandleEvent(event: unknown): event is TEvent;
  handleEvent(event: TEvent, context: Context): Promise<TResult>;
}

export type { StandardSchemaV1 };
