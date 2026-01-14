import type { Context } from 'aws-lambda';

export interface EventTypeRouter<TEvent = unknown, TResult = unknown> {
  canHandleEvent(event: unknown): event is TEvent;
  handleEvent(event: TEvent, context: Context): Promise<TResult>;
}

export interface Schema<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: unknown };
}

export type InferSchema<T> = T extends Schema<infer R> ? R : never;

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
