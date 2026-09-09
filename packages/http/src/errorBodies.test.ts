import { defaultJsonErrorBody, defaultTextErrorBody, fallbackServerError } from './errorBodies.js';
import { HTTPException } from './HTTPException.js';
import {
  BadRequest,
  Conflict,
  Forbidden,
  InternalServerError,
  NotFound,
  Unauthorised,
  UnprocessableContent,
} from './Response.js';

const defaultErrors: { name: string; helper: (message?: string) => HTTPException; defaultError: string }[] = [
  { name: 'BadRequest', helper: BadRequest, defaultError: 'Bad request' },
  { name: 'Unauthorised', helper: Unauthorised, defaultError: 'Unauthorised' },
  { name: 'Forbidden', helper: Forbidden, defaultError: 'Forbidden' },
  { name: 'NotFound', helper: NotFound, defaultError: 'Not found' },
  { name: 'Conflict', helper: Conflict, defaultError: 'Conflict' },
  { name: 'UnprocessableContent', helper: UnprocessableContent, defaultError: 'Unprocessable content' },
  { name: 'InternalServerError', helper: InternalServerError, defaultError: 'Internal server error' },
];

suite('defaultJsonErrorBody', () => {
  test('sends the message as an error object', () => {
    expect(defaultJsonErrorBody(NotFound('Could not find order ord-1'))).toEqual({
      error: 'Could not find order ord-1',
    });
  });

  test('sends the message and the context', () => {
    expect(defaultJsonErrorBody(Conflict('Order is locked', { orderId: 'ord-1' }))).toEqual({
      error: 'Order is locked',
      context: { orderId: 'ord-1' },
    });
  });

  test.each(defaultErrors)('sends the default error body for $name with no message', ({ helper, defaultError }) => {
    expect(defaultJsonErrorBody(helper())).toEqual({ error: defaultError });
  });

  test('sends the status name for another status with no message', () => {
    expect(defaultJsonErrorBody(new HTTPException(429))).toEqual({ error: 'Too Many Requests' });
  });

  test('sends a null context', () => {
    expect(defaultJsonErrorBody(NotFound(undefined, null))).toEqual({ error: 'Not found', context: null });
  });
});

suite('defaultTextErrorBody', () => {
  test('sends the message', () => {
    expect(defaultTextErrorBody(NotFound('Could not find order ord-1'))).toBe('Could not find order ord-1');
  });

  test('sends only the message when there is a context', () => {
    expect(defaultTextErrorBody(Conflict('Order is locked', { orderId: 'ord-1' }))).toBe('Order is locked');
  });

  test.each(defaultErrors)('sends the default message for $name with no message', ({ helper, defaultError }) => {
    expect(defaultTextErrorBody(helper())).toBe(defaultError);
  });
});

suite('fallbackServerError', () => {
  test('is a JSON 500 with the default error body for a JSON route', () => {
    expect(fallbackServerError('json')).toEqual({
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'content-type': 'application/json' },
      isBase64Encoded: false,
    });
  });

  test.each([
    'html',
    'text',
    'binary',
  ] as const)('is a plain-text 500 with the default message for a %s route', (kind) => {
    expect(fallbackServerError(kind)).toEqual({
      statusCode: 500,
      body: 'Internal server error',
      headers: { 'content-type': 'text/plain; charset=utf-8' },
      isBase64Encoded: false,
    });
  });
});
