import { HTTP_STATUS_CODES } from './constants.js';
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

suite('HTTPException', () => {
  test('is an Error with a status code, a message, a context and a stack', () => {
    const context = { orderId: 'ord-1' };

    const exception = new HTTPException(HTTP_STATUS_CODES.NOT_FOUND, 'Could not find order ord-1', context);

    expect(exception).toBeInstanceOf(Error);
    expect(exception.name).toBe('HTTPException');
    expect(exception.statusCode).toBe(404);
    expect(exception.message).toBe('Could not find order ord-1');
    expect(exception.context).toBe(context);
    expect(exception.stack).toContain('HTTPException');
  });

  test('has no context or headers when given none', () => {
    const exception = new HTTPException(409);

    expect(exception.context).toBeUndefined();
    expect(exception.headers).toBeUndefined();
  });

  test.each([
    { statusCode: 404, message: 'Not found' },
    { statusCode: 429, message: 'Too Many Requests' },
  ] as const)('uses the default message for $statusCode when it is given none', ({ statusCode, message }) => {
    expect(new HTTPException(statusCode, undefined, { orderId: 'ord-1' }).message).toBe(message);
  });

  test('keeps the headers it is given', () => {
    const exception = new HTTPException(401, undefined, undefined, { 'www-authenticate': 'Bearer' });

    expect(exception.headers).toEqual({ 'www-authenticate': 'Bearer' });
  });

  test.each([200, 302, 399, 600, 404.5])('throws for a status that is not 4xx or 5xx: %d', (statusCode) => {
    // @ts-expect-error - the type accepts only a 4xx or 5xx status, and this checks the runtime guard behind it
    expect(() => new HTTPException(statusCode)).toThrow(
      new RangeError(`An HTTPException needs a 4xx or 5xx status code, not ${statusCode}`),
    );
  });

  test.each([
    { name: 'BadRequest', helper: BadRequest, statusCode: 400 },
    { name: 'Unauthorised', helper: Unauthorised, statusCode: 401 },
    { name: 'Forbidden', helper: Forbidden, statusCode: 403 },
    { name: 'NotFound', helper: NotFound, statusCode: 404 },
    { name: 'Conflict', helper: Conflict, statusCode: 409 },
    { name: 'UnprocessableContent', helper: UnprocessableContent, statusCode: 422 },
    { name: 'InternalServerError', helper: InternalServerError, statusCode: 500 },
  ])('gives $name its status code, message, context and headers', ({ helper, statusCode }) => {
    const exception = helper('Not allowed', { orderId: 'ord-1' }, { 'x-reason': 'test' });

    expect(exception).toBeInstanceOf(HTTPException);
    expect(exception.statusCode).toBe(statusCode);
    expect(exception.message).toBe('Not allowed');
    expect(exception.context).toEqual({ orderId: 'ord-1' });
    expect(exception.headers).toEqual({ 'x-reason': 'test' });
  });
});
