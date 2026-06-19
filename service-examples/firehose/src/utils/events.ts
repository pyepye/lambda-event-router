import { isObject } from '@lambda-event-router/base';

// Filters run on the decoded record before any schema, so they read raw values and guard the shape.
// A record that is not JSON arrives here as a string and matches neither of these.
export function eventTypeOf(data: unknown): string | undefined {
  return isObject(data) && typeof data.eventType === 'string' ? data.eventType : undefined;
}

export function userAgentOf(data: unknown): string | undefined {
  return isObject(data) && typeof data.userAgent === 'string' ? data.userAgent : undefined;
}
