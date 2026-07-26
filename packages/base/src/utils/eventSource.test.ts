import * as testing from '@lambda-event-router/testing';
import {
  createApiGatewayLambdaAuthorizerRequestV1Event,
  createApiGatewayLambdaAuthorizerTokenEvent,
  createAppSyncEventsEvent,
  createKafkaRetryEvent,
  createS3TestEvent,
  createWebSocketEvent,
} from '@lambda-event-router/testing';

import { isObject } from './data.js';
import { isKnownEventSource } from './eventSource.js';

// Builders that make a fragment of an event rather than one Lambda is handed.
const NOT_WHOLE_EVENTS: Set<string> = new Set([
  'createDocumentDBChangeEvent', // one change document from inside a DocumentDB event
]);

// The builders return the aws-lambda interfaces, which carry no index signature.
function check(event: object): boolean {
  return isKnownEventSource(event as Record<string, unknown>);
}

suite('isKnownEventSource', () => {
  test('recognises a TOKEN Lambda authorizer event', () => {
    expect(check(createApiGatewayLambdaAuthorizerTokenEvent())).toBe(true);
  });

  test('recognises a REQUEST Lambda authorizer event', () => {
    expect(check(createApiGatewayLambdaAuthorizerRequestV1Event())).toBe(true);
  });

  test('recognises a WebSocket event', () => {
    expect(check(createWebSocketEvent())).toBe(true);
  });

  test('recognises an S3 test event', () => {
    expect(check(createS3TestEvent())).toBe(true);
  });

  test('recognises an AppSync Events channel handler event', () => {
    expect(check(createAppSyncEventsEvent())).toBe(true);
  });

  test('recognises a re-delivered Kafka batch, which names no source', () => {
    expect(check(createKafkaRetryEvent())).toBe(true);
  });

  // AppSync Events sends channel as { path, segments }, and no router claims a string one.
  test('leaves a custom payload naming a string channel alone', () => {
    expect(isKnownEventSource({ info: { channel: '/default/test' } })).toBe(false);
  });

  test('leaves a custom payload holding a records object alone', () => {
    expect(isKnownEventSource({ records: { 'my-topic': [{ id: 1 }] } })).toBe(false);
  });

  test('leaves a custom payload naming a type alone', () => {
    expect(isKnownEventSource({ type: 'REQUEST', reportId: 'r-1' })).toBe(false);
  });

  test('leaves a custom payload holding a requestContext alone', () => {
    expect(isKnownEventSource({ requestContext: { tenant: 'acme' } })).toBe(false);
  });

  test('recognises every whole event the testing package builds', () => {
    const builders = Object.entries(testing).filter(
      ([name, value]) =>
        name.startsWith('create') &&
        name.endsWith('Event') &&
        !name.endsWith('HandlerEvent') &&
        !NOT_WHOLE_EVENTS.has(name) &&
        typeof value === 'function',
    ) as [string, () => unknown][];

    const missed = builders
      .filter(([, build]) => {
        const built = build();
        const event = Array.isArray(built) ? built[0] : built;
        return isObject(event) && !isKnownEventSource(event);
      })
      .map(([name]) => name);

    expect(missed).toEqual([]);
    expect(builders.length).toBeGreaterThan(40);
  });
});
