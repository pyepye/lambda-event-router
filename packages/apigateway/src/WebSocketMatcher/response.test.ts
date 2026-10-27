import { isWebSocketResponse, WebSocketForbidden, WebSocketOk, WebSocketUnauthorized } from './response.js';

suite('webSocketResponse', () => {
  suite('isWebSocketResponse', () => {
    test('returns true for an object with a numeric statusCode', () => {
      expect(isWebSocketResponse({ statusCode: 200 })).toBe(true);
    });

    test('returns false for null', () => {
      expect(isWebSocketResponse(null)).toBe(false);
    });

    test('returns false for a string', () => {
      expect(isWebSocketResponse('not-a-response')).toBe(false);
    });

    test('returns false when statusCode is missing', () => {
      expect(isWebSocketResponse({ body: 'test' })).toBe(false);
    });

    test('returns false when statusCode is not a number', () => {
      expect(isWebSocketResponse({ statusCode: '200' })).toBe(false);
    });
  });

  test('WebSocketOk returns { statusCode: 200 }', () => {
    expect(WebSocketOk()).toEqual({ statusCode: 200 });
  });

  test('WebSocketForbidden returns { statusCode: 403 }', () => {
    expect(WebSocketForbidden()).toEqual({ statusCode: 403 });
  });

  test('WebSocketUnauthorized returns { statusCode: 401 }', () => {
    expect(WebSocketUnauthorized()).toEqual({ statusCode: 401 });
  });
});
