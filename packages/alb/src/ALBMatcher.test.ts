import { type ErrorInput, Html, NoContent, Ok } from '@latcher/http';
import { allEventBuilders, createALBEvent, createMockSchema, test } from '@latcher/testing';

import { ALBMatcher, createALBMatcher, defineRoute } from './ALBMatcher.js';
import type { HTTPMiddleware } from './types.js';

suite('ALBMatcher', () => {
  let matcher: ALBMatcher;

  beforeEach(() => {
    matcher = new ALBMatcher();
  });

  suite('createALBMatcher', () => {
    test('creates an ALBMatcher instance', () => {
      const matcher = createALBMatcher();
      expect(matcher).toBeInstanceOf(ALBMatcher);
    });
  });

  suite('response headers', () => {
    test('sends the multi-value form back when the request arrived in it', async ({ albHandlerEvent }) => {
      matcher.get({ filters: { path: '/items' }, handler: async () => Ok({ ok: true }, { 'x-page': '2' }) });

      const { event, context } = albHandlerEvent({
        event: { path: '/items', httpMethod: 'GET', headers: undefined, multiValueHeaders: { host: ['alb.example'] } },
      });
      const result = await matcher.handleEvent(event, context);

      expect(result.multiValueHeaders).toEqual({ 'content-type': ['application/json'], 'x-page': ['2'] });
      expect(result.headers).toBeUndefined();
    });

    test('sends the single-value form back when the request arrived in it', async ({ albHandlerEvent }) => {
      matcher.get({ filters: { path: '/items' }, handler: async () => Ok({ ok: true }, { 'x-page': '2' }) });

      const { event, context } = albHandlerEvent({ event: { path: '/items', httpMethod: 'GET' } });
      const result = await matcher.handleEvent(event, context);

      expect(result.headers).toEqual({ 'content-type': 'application/json', 'x-page': '2' });
      expect(result.multiValueHeaders).toBeUndefined();
    });

    test('base64 encodes a handler that answers with bytes', async ({ albHandlerEvent }) => {
      const label = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      matcher.get({
        filters: { path: '/labels/1' },
        responseType: 'binary',
        handler: async () => Ok(label, { 'content-type': 'image/png' }),
      });

      const { event, context } = albHandlerEvent({ event: { path: '/labels/1', httpMethod: 'GET' } });
      const result = await matcher.handleEvent(event, context);

      expect(result.body).toBe(label.toString('base64'));
      expect(result.isBase64Encoded).toBe(true);
    });
  });

  suite('cors', () => {
    test('answers an OPTIONS preflight when cors is configured', async ({ albHandlerEvent }) => {
      const corsMatcher = createALBMatcher({ cors: { origin: 'https://app.example.com' } });
      corsMatcher.get({ filters: { path: '/items' }, handler: async () => Ok({}) });
      corsMatcher.post({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const { event, context } = albHandlerEvent({
        event: { path: '/items', httpMethod: 'OPTIONS', headers: { origin: 'https://app.example.com' } },
      });
      const result = await corsMatcher.handleEvent(event, context);

      expect(result.statusCode).toBe(204);
      expect(result.headers).toEqual(
        expect.objectContaining({
          'Access-Control-Allow-Origin': 'https://app.example.com',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        }),
      );
    });

    test('adds cors headers to a handler response', async ({ albHandlerEvent }) => {
      const corsMatcher = createALBMatcher({ cors: { origin: '*' } });
      corsMatcher.get({ filters: { path: '/items' }, handler: async () => Ok({ data: 'test' }) });

      const { event, context } = albHandlerEvent({ event: { path: '/items' } });
      const result = await corsMatcher.handleEvent(event, context);

      expect(result.statusCode).toBe(200);
      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    });

    test('adds no cors headers when cors is left off', async ({ albHandlerEvent }) => {
      const plainMatcher = createALBMatcher();
      plainMatcher.get({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const { event, context } = albHandlerEvent({ event: { path: '/items' } });
      const result = await plainMatcher.handleEvent(event, context);

      expect(result.headers?.['Access-Control-Allow-Origin']).toBeUndefined();
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for a valid ALB event', () => {
      const event = createALBEvent();
      expect(matcher.canHandleEvent(event)).toBe(true);
    });
  });

  suite('route', () => {
    test('returns the matcher instance for chaining', () => {
      const definition = defineRoute({
        filters: {
          method: 'GET',
          path: '/items',
        },
      }).handle(async () => NoContent());

      const result = matcher.route(definition);

      expect(result).toBe(matcher);
    });
  });

  suite('HTTP method chaining', () => {
    test.each([
      { method: 'get' as const, path: '/items', handler: async () => Ok({ items: [] }) },
      { method: 'post' as const, path: '/items', handler: async () => Ok({ id: '1' }) },
      { method: 'put' as const, path: '/items/:id', handler: async () => Ok({ updated: true }) },
      { method: 'patch' as const, path: '/items/:id', handler: async () => Ok({ patched: true }) },
      { method: 'delete' as const, path: '/items/:id', handler: async () => NoContent() },
    ])('$method returns the matcher instance for chaining', ({ method, path, handler }) => {
      // @ts-expect-error - calling union of method signatures
      const result = matcher[method]({ filters: { path }, handler });

      expect(result).toBe(matcher);
    });
  });

  suite('handleEvent', () => {
    test('calls the matched handler and returns a response with statusCode and body', async ({ albHandlerEvent }) => {
      matcher.get({
        filters: {
          path: '/',
        },
        handler: async () => Ok({ message: 'hello' }),
      });

      const { event, context } = albHandlerEvent();
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 200,
          body: JSON.stringify({ message: 'hello' }),
        }),
      );
    });

    test('returns 404 when no route matches', async ({ albHandlerEvent }) => {
      matcher.get({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const { event, context } = albHandlerEvent({ event: { path: '/unknown' } });
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 404,
          body: JSON.stringify({ error: 'Not Found' }),
        }),
      );
    });

    test('hides the message of an unhandled error', async ({ albHandlerEvent }) => {
      matcher.get({
        filters: {
          path: '/',
        },
        handler: async () => {
          throw new Error('something broke');
        },
      });

      const { event, context } = albHandlerEvent();
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 500,
          body: JSON.stringify({ error: 'Internal Server Error' }),
        }),
      );
    });

    test('catches a non-Error throw and returns 500 with default message', async ({ albHandlerEvent }) => {
      matcher.get({
        filters: {
          path: '/',
        },
        handler: async () => {
          throw 'string error';
        },
      });

      const { event, context } = albHandlerEvent();
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 500,
          body: JSON.stringify({ error: 'Internal Server Error' }),
        }),
      );
    });

    test('validates the request before calling handler and returns 422 for body schema failure', async ({
      albHandlerEvent,
    }) => {
      const handler = vi.fn();
      const bodySchema = createMockSchema({ issues: [{ message: 'invalid body' }] });
      matcher.post({ filters: { path: '/' }, handler, bodySchema });

      const { event, context } = albHandlerEvent({ event: { httpMethod: 'POST', body: { bad: 'data' } } });
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 422,
        }),
      );
      expect(handler).not.toHaveBeenCalled();
    });

    test('passes extracted path params to the handler', async ({ albHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(Ok({ found: true }));
      matcher.get({ filters: { path: '/items/:id' }, handler });

      const { event, context } = albHandlerEvent({ event: { path: '/items/42' } });
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ path: { id: '42' } }));
    });

    test('passes query params to the handler', async ({ albHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(Ok({ items: [] }));
      matcher.get({ filters: { path: '/items' }, handler });

      const { event, context } = albHandlerEvent({
        event: { path: '/items', queryStringParameters: { page: '2', limit: '10' } },
      });
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ query: { page: '2', limit: '10' } }));
    });

    test('gives a bare HTTPMiddleware the output of the querySchema', async ({ albHandlerEvent }) => {
      let receivedQuery: unknown;
      // biome-ignore lint/nursery/useExplicitType: HTTPMiddleware types the parameters
      const readsQuery: HTTPMiddleware = async (request, next) => {
        receivedQuery = request.query;
        return next(request);
      };
      matcher.get({
        filters: { path: '/items' },
        querySchema: createMockSchema({ value: { limit: 10 } }),
        middleware: [readsQuery],
        handler: async () => NoContent(),
      });

      const { event, context } = albHandlerEvent({ event: { path: '/items', queryStringParameters: { limit: '10' } } });
      await matcher.handleEvent(event, context);

      expect(receivedQuery).toEqual({ limit: 10 });
    });

    test('passes parsed body to the handler', async ({ albHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(Ok({ id: 'new-1' }));
      matcher.post({ filters: { path: '/items' }, handler });

      const { event, context } = albHandlerEvent({
        event: {
          path: '/items',
          httpMethod: 'POST',
          body: { name: 'test-item' },
        },
      });
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: { name: 'test-item' } }));
    });
  });

  suite('handleEvent - custom', () => {
    test('matches route when custom returns true', async ({ albHandlerEvent }) => {
      const handler = vi.fn(async () => Ok({ message: 'hello' }));
      matcher.get({
        filters: { path: '/items', custom: () => true },
        handler,
      });

      const { event, context } = albHandlerEvent({ event: { path: '/items' } });
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 200,
          body: JSON.stringify({ message: 'hello' }),
        }),
      );
      expect(handler).toHaveBeenCalledOnce();
    });

    test('returns 404 when custom returns false', async ({ albHandlerEvent }) => {
      const handler = vi.fn(async () => Ok({}));
      matcher.get({
        filters: { path: '/items', custom: () => false },
        handler,
      });

      const { event, context } = albHandlerEvent({ event: { path: '/items' } });
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 404,
          body: JSON.stringify({ error: 'Not Found' }),
        }),
      );
      expect(handler).not.toHaveBeenCalled();
    });

    test('matches route when custom is async and resolves true', async ({ albHandlerEvent }) => {
      matcher.get({
        filters: {
          path: '/items',
          custom: async () => {
            await new Promise((r) => setTimeout(r, 1));
            return true;
          },
        },
        handler: async () => Ok({ message: 'hello' }),
      });

      const { event, context } = albHandlerEvent({ event: { path: '/items' } });
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 200,
          body: JSON.stringify({ message: 'hello' }),
        }),
      );
    });
  });
});

suite('ALBMatcher.canHandleEvent', () => {
  const ownEvents = ['createALBEvent'];

  test.each(allEventBuilders())('%s', async (name, build) => {
    const event = build();
    const isOwnEvent = ownEvents.includes(name);

    const claimed = await createALBMatcher().canHandleEvent(event);

    expect(claimed).toBe(isOwnEvent);
  });
  suite('response types', () => {
    const errors = {
      html: ({ statusCode, statusText }: ErrorInput): Html => Html(`<h1>${statusCode} ${statusText}</h1>`),
    };

    test('accepts an inline errors.html whose parameters are inferred', () => {
      expect(
        () =>
          new ALBMatcher({
            responseType: 'html',
            // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
            errors: { html: ({ statusCode }) => Html(`<h1>${statusCode}</h1>`) },
          }),
      ).not.toThrow();
      expect(() =>
        createALBMatcher({
          responseType: 'html',
          // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
          errors: { html: ({ statusCode }) => Html(`<h1>${statusCode}</h1>`) },
        }),
      ).not.toThrow();
    });

    test('sends Html and error pages from an HTML matcher', async ({ albHandlerEvent }) => {
      const htmlMatcher = new ALBMatcher({ responseType: 'html', errors });
      htmlMatcher.get({ filters: { path: '/orders' }, handler: async () => Html('<p>Orders</p>') });

      const page = albHandlerEvent({ event: { path: '/orders', httpMethod: 'GET' } });
      const missing = albHandlerEvent({ event: { path: '/missing', httpMethod: 'GET' } });
      const pageResult = await htmlMatcher.handleEvent(page.event, page.context);
      const missingResult = await htmlMatcher.handleEvent(missing.event, missing.context);

      expect(pageResult).toEqual(expect.objectContaining({ statusCode: 200, body: '<p>Orders</p>' }));
      expect(pageResult.headers).toEqual({ 'content-type': 'text/html; charset=utf-8' });
      expect(missingResult).toEqual(expect.objectContaining({ statusCode: 404, body: '<h1>404 Not Found</h1>' }));
    });

    test('rejects an HTML matcher with no errors.html', () => {
      // @ts-expect-error - an HTML matcher needs errors.html
      expect(() => new ALBMatcher({ responseType: 'html' })).toThrow(
        'Response type configuration error: an HTML matcher needs errors.html',
      );
    });
  });
});
