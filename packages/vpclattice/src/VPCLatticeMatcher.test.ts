import { type ErrorInput, Html, NoContent, Ok } from '@latcher/http';
import { allEventBuilders, createMockSchema, createVPCLatticeV2Event, test } from '@latcher/testing';

import type { HTTPMiddleware } from './types.js';
import { createVPCLatticeMatcher, defineRoute, VPCLatticeMatcher } from './VPCLatticeMatcher.js';

suite('VPCLatticeMatcher', () => {
  let matcher: VPCLatticeMatcher;

  beforeEach(() => {
    matcher = new VPCLatticeMatcher();
  });

  suite('createVPCLatticeMatcher', () => {
    test('creates a VPCLatticeMatcher instance', () => {
      const matcher = createVPCLatticeMatcher();
      expect(matcher).toBeInstanceOf(VPCLatticeMatcher);
    });
  });

  suite('cors', () => {
    test('answers an OPTIONS preflight when cors is configured', async ({ vpcLatticeV2HandlerEvent }) => {
      const corsMatcher = createVPCLatticeMatcher({ cors: { origin: 'https://app.example.com' } });
      corsMatcher.get({ filters: { path: '/items' }, handler: async () => Ok({}) });
      corsMatcher.post({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const { event, context } = vpcLatticeV2HandlerEvent({
        event: { path: '/items', method: 'OPTIONS', headers: { origin: ['https://app.example.com'] } },
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

    test('adds cors headers to a handler response', async ({ vpcLatticeV2HandlerEvent }) => {
      const corsMatcher = createVPCLatticeMatcher({ cors: { origin: '*' } });
      corsMatcher.get({ filters: { path: '/items' }, handler: async () => Ok({ data: 'test' }) });

      const { event, context } = vpcLatticeV2HandlerEvent({ event: { path: '/items' } });
      const result = await corsMatcher.handleEvent(event, context);

      expect(result.statusCode).toBe(200);
      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    });

    test('adds no cors headers when cors is left off', async ({ vpcLatticeV2HandlerEvent }) => {
      const plainMatcher = createVPCLatticeMatcher();
      plainMatcher.get({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const { event, context } = vpcLatticeV2HandlerEvent({ event: { path: '/items' } });
      const result = await plainMatcher.handleEvent(event, context);

      expect(result.headers?.['Access-Control-Allow-Origin']).toBeUndefined();
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for a valid VPC Lattice V2 event', () => {
      const event = createVPCLatticeV2Event();
      expect(matcher.canHandleEvent(event)).toBe(true);
    });

    test.each([
      { label: 'null', value: null },
      { label: 'a string', value: 'not an event' },
      { label: 'a number', value: 42 },
      { label: 'an array', value: [1, 2, 3] },
    ])('returns false for $label', ({ value }) => {
      expect(matcher.canHandleEvent(value)).toBe(false);
    });

    test('returns false for events missing key fields', () => {
      expect(matcher.canHandleEvent({ Records: [] })).toBe(false);
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
    test('calls the matched handler and returns a response with statusCode and body', async ({
      vpcLatticeV2HandlerEvent,
    }) => {
      matcher.get({
        filters: {
          path: '/',
        },
        handler: async () => Ok({ message: 'hello' }),
      });

      const { event, context } = vpcLatticeV2HandlerEvent();
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 200,
          body: JSON.stringify({ message: 'hello' }),
        }),
      );
    });

    test('returns 404 when no route matches', async ({ vpcLatticeV2HandlerEvent }) => {
      matcher.get({ filters: { path: '/items' }, handler: async () => Ok({}) });

      const { event, context } = vpcLatticeV2HandlerEvent({ event: { path: '/unknown' } });
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 404,
          body: JSON.stringify({ error: 'Not Found' }),
        }),
      );
    });

    test('hides the message of an unhandled error', async ({ vpcLatticeV2HandlerEvent }) => {
      matcher.get({
        filters: {
          path: '/',
        },
        handler: async () => {
          throw new Error('something broke');
        },
      });

      const { event, context } = vpcLatticeV2HandlerEvent();
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 500,
          body: JSON.stringify({ error: 'Internal Server Error' }),
        }),
      );
    });

    test('catches a non-Error throw and returns 500 with default message', async ({ vpcLatticeV2HandlerEvent }) => {
      matcher.get({
        filters: {
          path: '/',
        },
        handler: async () => {
          throw 'string error';
        },
      });

      const { event, context } = vpcLatticeV2HandlerEvent();
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 500,
          body: JSON.stringify({ error: 'Internal Server Error' }),
        }),
      );
    });

    test('validates the request before calling handler and returns 422 for body schema failure', async ({
      vpcLatticeV2HandlerEvent,
    }) => {
      const handler = vi.fn();
      const bodySchema = createMockSchema({ issues: [{ message: 'invalid body' }] });
      matcher.post({ filters: { path: '/' }, handler, bodySchema });

      const { event, context } = vpcLatticeV2HandlerEvent({
        event: { method: 'POST', body: { bad: 'data' } },
      });
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 422,
        }),
      );
      expect(handler).not.toHaveBeenCalled();
    });

    test('passes extracted path params to the handler', async ({ vpcLatticeV2HandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(Ok({ found: true }));
      matcher.get({ filters: { path: '/items/:id' }, handler });

      const { event, context } = vpcLatticeV2HandlerEvent({ event: { path: '/items/42' } });
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ path: { id: '42' } }));
    });

    test('passes query params to the handler', async ({ vpcLatticeV2HandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(Ok({ items: [] }));
      matcher.get({ filters: { path: '/items' }, handler });

      const { event, context } = vpcLatticeV2HandlerEvent({
        event: { path: '/items', queryStringParameters: { page: ['2'], limit: ['10'] } },
      });
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ query: { page: '2', limit: '10' } }));
    });

    test('gives a bare HTTPMiddleware the output of the querySchema', async ({ vpcLatticeV2HandlerEvent }) => {
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

      const { event, context } = vpcLatticeV2HandlerEvent({
        event: { path: '/items', queryStringParameters: { limit: ['10'] } },
      });
      await matcher.handleEvent(event, context);

      expect(receivedQuery).toEqual({ limit: 10 });
    });

    test('passes parsed body to the handler', async ({ vpcLatticeV2HandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(Ok({ id: 'new-1' }));
      matcher.post({ filters: { path: '/items' }, handler });

      const { event, context } = vpcLatticeV2HandlerEvent({
        event: {
          path: '/items',
          method: 'POST',
          body: { name: 'test-item' },
        },
      });
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: { name: 'test-item' } }));
    });
  });

  suite('handleEvent - custom', () => {
    test('matches route when custom returns true', async ({ vpcLatticeV2HandlerEvent }) => {
      const handler = vi.fn(async () => Ok({ message: 'hello' }));
      matcher.get({
        filters: { path: '/items', custom: () => true },
        handler,
      });

      const { event, context } = vpcLatticeV2HandlerEvent({ event: { path: '/items' } });
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 200,
          body: JSON.stringify({ message: 'hello' }),
        }),
      );
      expect(handler).toHaveBeenCalledOnce();
    });

    test('returns 404 when custom returns false', async ({ vpcLatticeV2HandlerEvent }) => {
      const handler = vi.fn(async () => Ok({}));
      matcher.get({
        filters: { path: '/items', custom: () => false },
        handler,
      });

      const { event, context } = vpcLatticeV2HandlerEvent({ event: { path: '/items' } });
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 404,
          body: JSON.stringify({ error: 'Not Found' }),
        }),
      );
      expect(handler).not.toHaveBeenCalled();
    });

    test('matches route when custom is async and resolves true', async ({ vpcLatticeV2HandlerEvent }) => {
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

      const { event, context } = vpcLatticeV2HandlerEvent({ event: { path: '/items' } });
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

suite('VPCLatticeMatcher.canHandleEvent', () => {
  const ownEvents = ['createVPCLatticeV1Event', 'createVPCLatticeV2Event'];

  test.each(allEventBuilders())('%s', async (name, build) => {
    const event = build();
    const isOwnEvent = ownEvents.includes(name);

    const claimed = await createVPCLatticeMatcher().canHandleEvent(event);

    expect(claimed).toBe(isOwnEvent);
  });
  suite('response types', () => {
    const errors = {
      html: ({ statusCode, statusText }: ErrorInput): Html => Html(`<h1>${statusCode} ${statusText}</h1>`),
    };

    test('sends Html and error pages from an HTML matcher', async ({ vpcLatticeV2HandlerEvent }) => {
      const htmlMatcher = new VPCLatticeMatcher({ responseType: 'html', errors });
      htmlMatcher.get({ filters: { path: '/orders' }, handler: async () => Html('<p>Orders</p>') });

      const page = vpcLatticeV2HandlerEvent({ event: { path: '/orders' } });
      const missing = vpcLatticeV2HandlerEvent({ event: { path: '/missing' } });
      const pageResult = await htmlMatcher.handleEvent(page.event, page.context);
      const missingResult = await htmlMatcher.handleEvent(missing.event, missing.context);

      expect(pageResult).toEqual(expect.objectContaining({ statusCode: 200, body: '<p>Orders</p>' }));
      expect(pageResult.headers).toEqual({ 'content-type': 'text/html; charset=utf-8' });
      expect(missingResult).toEqual(expect.objectContaining({ statusCode: 404, body: '<h1>404 Not Found</h1>' }));
    });

    test('accepts an inline errors.html whose parameters are inferred', () => {
      expect(
        () =>
          new VPCLatticeMatcher({
            responseType: 'html',
            // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
            errors: { html: ({ statusCode }) => Html(`<h1>${statusCode}</h1>`) },
          }),
      ).not.toThrow();
      expect(() =>
        createVPCLatticeMatcher({
          responseType: 'html',
          // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
          errors: { html: ({ statusCode }) => Html(`<h1>${statusCode}</h1>`) },
        }),
      ).not.toThrow();
    });

    test('rejects an HTML matcher with no errors.html', () => {
      // @ts-expect-error - an HTML matcher needs errors.html
      expect(() => new VPCLatticeMatcher({ responseType: 'html' })).toThrow(
        'Response type configuration error: an HTML matcher needs errors.html',
      );
    });
  });
});
