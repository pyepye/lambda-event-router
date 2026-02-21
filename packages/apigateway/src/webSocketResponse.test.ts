import { WebSocketForbidden, WebSocketOk, WebSocketUnauthorised } from './webSocketResponse.js';

suite('webSocketResponse', () => {
  test('WebSocketOk returns { statusCode: 200 }', () => {
    expect(WebSocketOk()).toEqual({ statusCode: 200 });
  });

  test('WebSocketForbidden returns { statusCode: 403 }', () => {
    expect(WebSocketForbidden()).toEqual({ statusCode: 403 });
  });

  test('WebSocketUnauthorised returns { statusCode: 401 }', () => {
    expect(WebSocketUnauthorised()).toEqual({ statusCode: 401 });
  });
});
