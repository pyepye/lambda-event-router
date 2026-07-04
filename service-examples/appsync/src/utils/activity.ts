import { isObject } from '@lambda-event-router/base';

export interface ActivityEvent {
  id: string;
  payload: Record<string, unknown>;
}

export interface OutgoingEvent {
  id: string;
  payload?: Record<string, unknown>;
  error?: string;
}

export interface PublishResponse {
  events: OutgoingEvent[];
}

// The publish API takes each event as a JSON string. AppSync parses it, so the handler is handed an
// object under `payload` alongside the id AppSync minted for it.
export function activityEvents(events: Record<string, unknown>[]): ActivityEvent[] {
  return events.map((event) => ({
    id: String(event.id),
    payload: isObject(event.payload) ? event.payload : {},
  }));
}
