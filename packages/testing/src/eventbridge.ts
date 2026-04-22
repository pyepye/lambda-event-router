import type { Context } from 'aws-lambda';

import { createMockContext } from './context.js';
import { deepMerge } from './deepMerge.js';
import type { DeepPartial } from './deepPartial.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

export interface EventBridgeEvent<TDetail = unknown> {
  version: string;
  id: string;
  source: string;
  'detail-type': string;
  account: string;
  time: string;
  region: string;
  resources: string[];
  detail: TDetail;
}

export interface EventBridgeHandlerEvent {
  event: EventBridgeEvent;
  context: Context;
}

export type EventBridgeEventOverrides = DeepPartial<EventBridgeEvent>;

export function createEventBridgeEvent(overrides: EventBridgeEventOverrides = {}): EventBridgeEvent {
  const defaults: EventBridgeEvent = {
    version: '0',
    id: crypto.randomUUID(),
    source: 'my.app',
    'detail-type': 'OrderPlaced',
    account: '123456789012',
    time: '2024-01-01T00:00:00Z',
    region: 'us-east-1',
    resources: [],
    detail: { orderId: '12345' },
  };

  return deepMerge(defaults, overrides);
}

export interface CreateEventBridgeHandlerEventOptions {
  event?: EventBridgeEventOverrides;
  context?: Partial<Context>;
}

export function createEventBridgeHandlerEvent(
  options: CreateEventBridgeHandlerEventOptions = {},
): EventBridgeHandlerEvent {
  const event = createEventBridgeEvent(options.event);
  const context = createMockContext(options.context);
  return { event, context };
}

export interface EventBridgeFixtures {
  eventBridgeEvent: (overrides?: EventBridgeEventOverrides) => EventBridgeEvent;
  eventBridgeHandlerEvent: (options?: CreateEventBridgeHandlerEventOptions) => EventBridgeHandlerEvent;
}

export const eventBridgeFixtures: FixtureMap<EventBridgeFixtures> = {
  eventBridgeEvent: fixture(createEventBridgeEvent),
  eventBridgeHandlerEvent: fixture(createEventBridgeHandlerEvent),
};
