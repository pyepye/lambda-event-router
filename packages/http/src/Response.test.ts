import {
  BadRequest,
  Conflict,
  Created,
  Forbidden,
  InternalServerError,
  NoContent,
  NotFound,
  Ok,
  PermanentRedirect,
  Response,
  TemporaryRedirect,
  Unauthorised,
  UnprocessableContent,
} from './Response.js';

suite('Response', () => {
  suite('static factory methods', () => {
    suite('Ok', () => {
      test('returns a 200 response with the given body', () => {
        const result = Response.Ok({ items: [1, 2, 3] });

        expect(result.statusCode).toBe(200);
        expect(result.body).toEqual({ items: [1, 2, 3] });
      });
    });

    suite('Created', () => {
      test('returns a 201 response with the given body', () => {
        const result = Response.Created({ id: 'new-1' });

        expect(result.statusCode).toBe(201);
        expect(result.body).toEqual({ id: 'new-1' });
      });
    });

    suite('NoContent', () => {
      test('returns a 204 response with undefined body', () => {
        const result = Response.NoContent();

        expect(result.statusCode).toBe(204);
        expect(result.body).toBeUndefined();
      });
    });

    suite('TemporaryRedirect', () => {
      test('returns a 307 response with a Location header', () => {
        const result = Response.TemporaryRedirect('https://example.com/new');

        expect(result.statusCode).toBe(307);
        expect(result.body).toBeUndefined();
        expect(result.headers).toEqual({ Location: 'https://example.com/new' });
      });
    });

    suite('PermanentRedirect', () => {
      test('returns a 308 response with a Location header', () => {
        const result = Response.PermanentRedirect('https://example.com/permanent');

        expect(result.statusCode).toBe(308);
        expect(result.body).toBeUndefined();
        expect(result.headers).toEqual({ Location: 'https://example.com/permanent' });
      });
    });

    test.each([
      {
        method: 'BadRequest' as const,
        statusCode: 400,
        defaultError: 'Bad request',
        customBody: { detail: 'missing field' },
      },
      {
        method: 'Unauthorised' as const,
        statusCode: 401,
        defaultError: 'Unauthorised',
        customBody: { reason: 'token expired' },
      },
      {
        method: 'Forbidden' as const,
        statusCode: 403,
        defaultError: 'Forbidden',
        customBody: { reason: 'insufficient permissions' },
      },
      { method: 'NotFound' as const, statusCode: 404, defaultError: 'Not found', customBody: { resource: 'user' } },
      { method: 'Conflict' as const, statusCode: 409, defaultError: 'Conflict', customBody: { field: 'email' } },
      {
        method: 'UnprocessableContent' as const,
        statusCode: 422,
        defaultError: 'Unprocessable content',
        customBody: { errors: ['name is required'] },
      },
      {
        method: 'InternalServerError' as const,
        statusCode: 500,
        defaultError: 'Internal server error',
        customBody: { trace: 'abc' },
      },
    ])('$method returns $statusCode with the default error message', ({ method, statusCode, defaultError }) => {
      const result = Response[method]();

      expect(result.statusCode).toBe(statusCode);
      expect(result.body).toEqual({ error: defaultError });
    });

    test.each([
      { method: 'BadRequest' as const, statusCode: 400, customBody: { detail: 'missing field' } },
      { method: 'Unauthorised' as const, statusCode: 401, customBody: { reason: 'token expired' } },
      { method: 'Forbidden' as const, statusCode: 403, customBody: { reason: 'insufficient permissions' } },
      { method: 'NotFound' as const, statusCode: 404, customBody: { resource: 'user' } },
      { method: 'Conflict' as const, statusCode: 409, customBody: { field: 'email' } },
      { method: 'UnprocessableContent' as const, statusCode: 422, customBody: { errors: ['name is required'] } },
      { method: 'InternalServerError' as const, statusCode: 500, customBody: { trace: 'abc' } },
    ])('$method returns $statusCode with a custom body', ({ method, statusCode, customBody }) => {
      const result = Response[method](customBody);

      expect(result.statusCode).toBe(statusCode);
      expect(result.body).toEqual(customBody);
    });
  });

  suite('isHTTPResponse', () => {
    test('returns true for a valid HTTPResponse', () => {
      const response = { statusCode: 200, body: 'ok' };

      expect(Response.isHTTPResponse(response)).toBe(true);
    });

    test('returns false for null', () => {
      expect(Response.isHTTPResponse(null)).toBe(false);
    });

    test('returns false for a non-object', () => {
      expect(Response.isHTTPResponse('string')).toBe(false);
    });

    test('returns false when statusCode is missing', () => {
      expect(Response.isHTTPResponse({ body: 'ok' })).toBe(false);
    });

    test('returns false when body is missing', () => {
      expect(Response.isHTTPResponse({ statusCode: 200 })).toBe(false);
    });

    test('returns false when statusCode is not a number', () => {
      expect(Response.isHTTPResponse({ statusCode: '200', body: 'ok' })).toBe(false);
    });
  });

  suite('create', () => {
    let response: Response;

    beforeEach(() => {
      response = new Response();
    });

    test('converts an HTTPResponse to a finalized response', () => {
      const result = response.create(Response.Ok({ message: 'hello' }));

      expect(result).toEqual({
        statusCode: 200,
        body: JSON.stringify({ message: 'hello' }),
        headers: { 'content-type': 'application/json' },
      });
    });

    test('returns a 204 with empty body for null', () => {
      const result = response.create(null);

      expect(result).toEqual({ statusCode: 204, body: '' });
    });

    test('returns a 204 with empty body for undefined', () => {
      const result = response.create(undefined);

      expect(result).toEqual({ statusCode: 204, body: '' });
    });

    test('returns a 204 for an empty string', () => {
      const result = response.create('');

      expect(result).toEqual({ statusCode: 204, body: '' });
    });

    test('returns a 204 for true', () => {
      const result = response.create(true);

      expect(result).toEqual({ statusCode: 204, body: '' });
    });

    test('returns a 204 for an empty object', () => {
      const result = response.create({});

      expect(result).toEqual({ statusCode: 204, body: '' });
    });

    test('wraps a non-HTTPResponse value in a 200', () => {
      const result = response.create({ data: 'value' });

      expect(result).toEqual({
        statusCode: 200,
        body: JSON.stringify({ data: 'value' }),
        headers: { 'content-type': 'application/json' },
      });
    });

    test('converts a string body to a 200 response', () => {
      const result = response.create('hello');

      expect(result).toEqual({ statusCode: 200, body: 'hello' });
    });

    test('converts a number body to a 200 response', () => {
      const result = response.create(42);

      expect(result).toEqual({ statusCode: 200, body: '42' });
    });

    test('preserves headers from the HTTPResponse', () => {
      const result = response.create(Response.TemporaryRedirect('/new-location'));

      expect(result).toEqual({ statusCode: 307, body: '', headers: { Location: '/new-location' } });
    });

    test('returns empty string for a function body', () => {
      const result = response.create(Response.Ok(() => {}));

      expect(result).toEqual({ statusCode: 200, body: '' });
    });

    test('returns empty string for NaN body', () => {
      const result = response.create(Response.Ok(Number.NaN));

      expect(result).toEqual({ statusCode: 200, body: '' });
    });

    test('converts a boolean body to its string representation', () => {
      const result = response.create(Response.Ok(false));

      expect(result).toEqual({ statusCode: 200, body: 'false' });
    });

    test('falls back to String() for a body with circular references', () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;

      const result = response.create(Response.Ok(circular));

      expect(result).toEqual(expect.objectContaining({ body: String(circular) }));
    });
  });

  suite('instance convenience methods', () => {
    let response: Response;

    beforeEach(() => {
      response = new Response();
    });

    test.each([
      { method: 'unauthorised' as const, statusCode: 401, defaultError: 'Unauthorised' },
      { method: 'forbidden' as const, statusCode: 403, defaultError: 'Forbidden' },
      { method: 'notFound' as const, statusCode: 404, defaultError: 'Not found' },
      { method: 'badRequest' as const, statusCode: 400, defaultError: 'Bad request' },
      { method: 'unprocessableContent' as const, statusCode: 422, defaultError: 'Unprocessable content' },
      { method: 'internalServerError' as const, statusCode: 500, defaultError: 'Internal server error' },
    ])('$method returns $statusCode with the default error message', ({ method, statusCode, defaultError }) => {
      const result = response[method]();

      expect(result).toEqual(expect.objectContaining({ statusCode, body: JSON.stringify({ error: defaultError }) }));
    });

    test.each([
      { method: 'unauthorised' as const, statusCode: 401, customMessage: 'token expired' },
      { method: 'forbidden' as const, statusCode: 403, customMessage: 'no access' },
      { method: 'notFound' as const, statusCode: 404, customMessage: 'user not found' },
      { method: 'badRequest' as const, statusCode: 400, customMessage: 'missing name' },
      { method: 'unprocessableContent' as const, statusCode: 422, customMessage: 'invalid email' },
      { method: 'internalServerError' as const, statusCode: 500, customMessage: 'db connection failed' },
    ])('$method returns $statusCode with a custom message', ({ method, statusCode, customMessage }) => {
      const result = response[method](customMessage);

      expect(result).toEqual(expect.objectContaining({ statusCode, body: JSON.stringify({ error: customMessage }) }));
    });
  });

  // Behavioral coverage already exists in the static factory method testing above
  suite('standalone exports', () => {
    test.each([
      { name: 'Ok', fn: Ok },
      { name: 'Created', fn: Created },
      { name: 'NoContent', fn: NoContent },
      { name: 'TemporaryRedirect', fn: TemporaryRedirect },
      { name: 'PermanentRedirect', fn: PermanentRedirect },
      { name: 'BadRequest', fn: BadRequest },
      { name: 'Unauthorised', fn: Unauthorised },
      { name: 'Forbidden', fn: Forbidden },
      { name: 'NotFound', fn: NotFound },
      { name: 'Conflict', fn: Conflict },
      { name: 'UnprocessableContent', fn: UnprocessableContent },
      { name: 'InternalServerError', fn: InternalServerError },
    ] as const)('$name is re-exported from the Response class', ({ name, fn }) => {
      expect(fn).toBe(Response[name]);
    });
  });
});
