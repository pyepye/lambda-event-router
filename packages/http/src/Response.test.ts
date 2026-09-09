import type { MockInstance } from 'vitest';

import { getLogger } from '@lambda-event-router/base';

import { Html } from './html.js';
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

function thrownBy(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  return undefined;
}

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
        isBase64Encoded: false,
      });
    });

    test('returns a 204 with empty body for null', () => {
      const result = response.create(null);

      expect(result).toEqual({ statusCode: 204, body: '', isBase64Encoded: false });
    });

    test('returns a 204 with empty body for undefined', () => {
      const result = response.create(undefined);

      expect(result).toEqual({ statusCode: 204, body: '', isBase64Encoded: false });
    });

    test('sends an empty string on a JSON route as a JSON string', () => {
      const result = response.create('');

      expect(result).toEqual({
        statusCode: 200,
        body: '""',
        headers: { 'content-type': 'application/json' },
        isBase64Encoded: false,
      });
    });

    test('sends true on a JSON route as JSON', () => {
      const result = response.create(true);

      expect(result).toEqual({
        statusCode: 200,
        body: 'true',
        headers: { 'content-type': 'application/json' },
        isBase64Encoded: false,
      });
    });

    test('sends an empty object on a JSON route as a 200', () => {
      const result = response.create({});

      expect(result).toEqual({
        statusCode: 200,
        body: '{}',
        headers: { 'content-type': 'application/json' },
        isBase64Encoded: false,
      });
    });

    test('wraps a non-HTTPResponse value in a 200', () => {
      const result = response.create({ data: 'value' });

      expect(result).toEqual({
        statusCode: 200,
        body: JSON.stringify({ data: 'value' }),
        headers: { 'content-type': 'application/json' },
        isBase64Encoded: false,
      });
    });

    test('gives an array HTTPResponse body a JSON content type', () => {
      const result = response.create(Response.Ok([1, 2, 3]));

      expect(result).toEqual({
        statusCode: 200,
        body: JSON.stringify([1, 2, 3]),
        headers: { 'content-type': 'application/json' },
        isBase64Encoded: false,
      });
    });

    test('wraps a bare array in a 200 with a JSON content type', () => {
      const result = response.create([1, 2]);

      expect(result).toEqual({
        statusCode: 200,
        body: JSON.stringify([1, 2]),
        headers: { 'content-type': 'application/json' },
        isBase64Encoded: false,
      });
    });

    test('treats an empty array as a JSON body, not no content', () => {
      const result = response.create([]);

      expect(result).toEqual({
        statusCode: 200,
        body: '[]',
        headers: { 'content-type': 'application/json' },
        isBase64Encoded: false,
      });
    });

    test('sends a string on a JSON route as a JSON string', () => {
      const result = response.create('hello');

      expect(result).toEqual({
        statusCode: 200,
        body: '"hello"',
        headers: { 'content-type': 'application/json' },
        isBase64Encoded: false,
      });
    });

    test('sends a string in an ApiResponse on a JSON route as a JSON string', () => {
      const result = response.create(Response.Ok('hello'));

      expect(result).toEqual({
        statusCode: 200,
        body: '"hello"',
        headers: { 'content-type': 'application/json' },
        isBase64Encoded: false,
      });
    });

    test('sends a number on a JSON route as JSON', () => {
      const result = response.create(42);

      expect(result).toEqual({
        statusCode: 200,
        body: '42',
        headers: { 'content-type': 'application/json' },
        isBase64Encoded: false,
      });
    });

    test('preserves headers from the HTTPResponse', () => {
      const result = response.create(Response.TemporaryRedirect('/new-location'));

      expect(result).toEqual({
        statusCode: 307,
        body: '',
        headers: { Location: '/new-location' },
        isBase64Encoded: false,
      });
    });

    test('does not mutate the given response object or its headers', () => {
      const sharedHeaders = { 'cache-control': 'no-store' };
      const shared = Response.Ok({ ok: true }, sharedHeaders);

      const result = response.create(shared);
      expect(result.headers).toEqual({ 'cache-control': 'no-store', 'content-type': 'application/json' });

      // A module-level headers constant reused across warm invocations must not gain content-type
      expect(sharedHeaders).toEqual({ 'cache-control': 'no-store' });
      expect(shared.headers).toBe(sharedHeaders);
    });

    test('does not add a headers key to a response that had none', () => {
      const shared = { statusCode: 200, body: { ok: true } };

      response.create(shared);

      expect(Object.hasOwn(shared, 'headers')).toBe(false);
    });

    test('sends false on a JSON route as JSON', () => {
      const result = response.create(Response.Ok(false));

      expect(result).toEqual({
        statusCode: 200,
        body: 'false',
        headers: { 'content-type': 'application/json' },
        isBase64Encoded: false,
      });
    });

    test('base64 encodes a Buffer body and gives it a byte content type', () => {
      const bytes = Buffer.from([0x00, 0x01, 0xff]);

      const result = response.create(bytes);

      expect(result).toEqual({
        statusCode: 200,
        body: bytes.toString('base64'),
        headers: { 'content-type': 'application/octet-stream' },
        isBase64Encoded: true,
      });
    });

    test('base64 encodes a Uint8Array body', () => {
      const bytes = Uint8Array.from([0x10, 0x20]);

      const result = response.create(bytes);

      expect(result.body).toBe(Buffer.from(bytes).toString('base64'));
      expect(result.isBase64Encoded).toBe(true);
    });

    test('base64 encodes an ArrayBuffer body', () => {
      const bytes = Uint8Array.from([0x10, 0x20]);

      const result = response.create(bytes.buffer);

      expect(result.body).toBe(Buffer.from(bytes).toString('base64'));
      expect(result.isBase64Encoded).toBe(true);
    });

    test('keeps the content type a handler set on a byte body', () => {
      const bytes = Buffer.from([0x25, 0x50, 0x44, 0x46]);

      const result = response.create(Response.Ok(bytes, { 'content-type': 'application/pdf' }));

      expect(result.headers).toEqual({ 'content-type': 'application/pdf' });
      expect(result.isBase64Encoded).toBe(true);
    });

    test('keeps a content type set with different letter case on a JSON body', () => {
      const result = response.create(Response.Ok({ ok: true }, { 'Content-Type': 'application/problem+json' }));

      expect(result.headers).toEqual({ 'Content-Type': 'application/problem+json' });
    });

    test('keeps a content type set with different letter case on a byte body', () => {
      const result = response.create(Response.Ok(Buffer.from([0x25]), { 'CONTENT-TYPE': 'application/pdf' }));

      expect(result.headers).toEqual({ 'CONTENT-TYPE': 'application/pdf' });
    });
  });

  suite('create with a body that is not JSON', () => {
    let response: Response;
    let errorSpy: MockInstance;

    beforeEach(() => {
      response = new Response();
      errorSpy = vi.spyOn(getLogger(), 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
      errorSpy.mockRestore();
    });

    test('throws a 500 and logs for a function body', () => {
      const thrown = thrownBy(() => response.create(Response.Ok(() => {})));

      expect(thrown).toEqual(Response.InternalServerError());
      expect(errorSpy).toHaveBeenCalledWith('Response body cannot be sent as JSON', { bodyType: 'function' });
    });

    test('throws a 500 and logs for a bare function body', () => {
      const thrown = thrownBy(() => response.create(() => {}));

      expect(thrown).toEqual(Response.InternalServerError());
      expect(errorSpy).toHaveBeenCalledOnce();
    });

    test.each([
      { name: 'NaN', body: Number.NaN },
      { name: 'Infinity', body: Number.POSITIVE_INFINITY },
    ])('throws a 500 and logs for a $name body', ({ body }) => {
      const thrown = thrownBy(() => response.create(Response.Ok(body)));

      expect(thrown).toEqual(Response.InternalServerError());
      expect(errorSpy).toHaveBeenCalledWith('Response body cannot be sent as JSON', { bodyType: 'number' });
    });

    test('throws a 500 and logs for a circular body', () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;

      const thrown = thrownBy(() => response.create(Response.Ok(circular)));

      expect(thrown).toEqual(Response.InternalServerError());
      expect(errorSpy).toHaveBeenCalledWith('Response body cannot be sent as JSON', {
        bodyType: 'object',
        error: expect.any(TypeError),
      });
    });

    test('throws a 500 and logs for a BigInt body', () => {
      const thrown = thrownBy(() => response.create(Response.Ok(BigInt(1))));

      expect(thrown).toEqual(Response.InternalServerError());
      expect(errorSpy).toHaveBeenCalledWith('Response body cannot be sent as JSON', {
        bodyType: 'bigint',
        error: expect.any(TypeError),
      });
    });
  });

  suite('create for HTML, text and binary routes', () => {
    const html = { kind: 'html', contentType: 'text/html; charset=utf-8' } as const;
    const text = { kind: 'text', contentType: 'text/plain; charset=utf-8' } as const;
    const csv = { kind: 'text', contentType: 'text/csv' } as const;
    const binary = { kind: 'binary', contentType: 'application/pdf' } as const;
    let response: Response;
    let errorSpy: MockInstance;

    beforeEach(() => {
      response = new Response();
      errorSpy = vi.spyOn(getLogger(), 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
      errorSpy.mockRestore();
    });

    test('sends Html with a text/html content type', () => {
      const result = response.create(Html('<p>Order ord-1</p>'), html);

      expect(result).toEqual({
        statusCode: 200,
        body: '<p>Order ord-1</p>',
        headers: { 'content-type': 'text/html; charset=utf-8' },
        isBase64Encoded: false,
      });
    });

    test('sends a string on a text route with a text/plain content type', () => {
      const result = response.create('ok', text);

      expect(result).toEqual({
        statusCode: 200,
        body: 'ok',
        headers: { 'content-type': 'text/plain; charset=utf-8' },
        isBase64Encoded: false,
      });
    });

    test('sends an empty string on a text route as a 200 with an empty body', () => {
      const result = response.create('', text);

      expect(result).toEqual(expect.objectContaining({ statusCode: 200, body: '' }));
    });

    test('answers 204 for undefined and null on a text route', () => {
      expect(response.create(undefined, text)).toEqual({ statusCode: 204, body: '', isBase64Encoded: false });
      expect(response.create(null, text)).toEqual({ statusCode: 204, body: '', isBase64Encoded: false });
    });

    test("uses the route's content type", () => {
      const result = response.create('sku,quantity', csv);

      expect(result.headers).toEqual({ 'content-type': 'text/csv' });
    });

    test('keeps the status and headers of an ApiResponse on a text route', () => {
      const result = response.create(Response.Created('ok', { location: '/labels/1' }), text);

      expect(result).toEqual({
        statusCode: 201,
        body: 'ok',
        headers: { 'content-type': 'text/plain; charset=utf-8', location: '/labels/1' },
        isBase64Encoded: false,
      });
    });

    test('JSON-encodes a string with a JSON content-type header on a text route', () => {
      const result = response.create(
        { statusCode: 200, body: 'ok', headers: { 'Content-Type': 'application/json' } },
        text,
      );

      expect(result).toEqual(expect.objectContaining({ body: JSON.stringify('ok') }));
    });

    test('JSON-encodes a body with a +json content-type header', () => {
      const result = response.create(
        { statusCode: 400, body: 'Bad SKU', headers: { 'content-type': 'application/problem+json' } },
        text,
      );

      expect(result.body).toBe(JSON.stringify('Bad SKU'));
    });

    test('JSON-encodes an object with a content-type header that is not JSON, and keeps the header', () => {
      const result = response.create(
        { statusCode: 200, body: { sku: 'brk-9' }, headers: { 'content-type': 'text/csv' } },
        text,
      );

      expect(result).toEqual({
        statusCode: 200,
        body: JSON.stringify({ sku: 'brk-9' }),
        headers: { 'content-type': 'text/csv' },
        isBase64Encoded: false,
      });
    });

    test.each([
      { name: 'an object on a text route', body: { sku: 'brk-9' }, responseType: text, bodyType: 'object' },
      { name: 'a number on a text route', body: 42, responseType: text, bodyType: 'number' },
      { name: 'an object on an HTML route', body: { sku: 'brk-9' }, responseType: html, bodyType: 'object' },
      { name: 'an object on a binary route', body: { sku: 'brk-9' }, responseType: binary, bodyType: 'object' },
    ])('throws a 500 and logs for $name with no content-type header', ({ body, responseType, bodyType }) => {
      const thrown = thrownBy(() => response.create(body, responseType));

      expect(thrown).toEqual(Response.InternalServerError());
      expect(errorSpy).toHaveBeenCalledWith('Response body is not a string', {
        responseType: responseType.kind,
        bodyType,
      });
    });

    test('sends a string on a binary route as it is', () => {
      const result = response.create('%PDF', binary);

      expect(result).toEqual({
        statusCode: 200,
        body: '%PDF',
        headers: { 'content-type': 'application/pdf' },
        isBase64Encoded: false,
      });
    });

    test("sends bytes on a binary route as base64 with the route's content type", () => {
      const pdf = Buffer.from('%PDF-1.7');

      const result = response.create(pdf, binary);

      expect(result).toEqual({
        statusCode: 200,
        body: pdf.toString('base64'),
        headers: { 'content-type': 'application/pdf' },
        isBase64Encoded: true,
      });
    });

    test('sends bytes on a text route as base64 with a byte content type', () => {
      const pdf = Buffer.from('%PDF-1.7');

      const result = response.create(pdf, text);

      expect(result).toEqual({
        statusCode: 200,
        body: pdf.toString('base64'),
        headers: { 'content-type': 'application/octet-stream' },
        isBase64Encoded: true,
      });
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
