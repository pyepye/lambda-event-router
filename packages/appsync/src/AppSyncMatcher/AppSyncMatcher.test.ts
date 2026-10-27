import type { AppSyncResolverEvent } from 'aws-lambda';

import type { MockInstance } from 'vitest';

import * as base from '@latcher/base';
import {
  allEventBuilders,
  createAppSyncResolverEvent,
  createMockContext,
  createMockSchema,
  test,
} from '@latcher/testing';

import { AppSyncMatcher, createAppSyncMatcher, defineRoute } from './AppSyncMatcher.js';
import type { AppSyncResolverFilterInput, AppSyncResolverRequest } from './types.js';

type AppSyncNext = (request: AppSyncResolverRequest) => Promise<unknown>;

const validateSchemaSpy: MockInstance = vi.spyOn(base, 'validateSchema');

suite('AppSyncMatcher', () => {
  let matcher: AppSyncMatcher;

  beforeEach(() => {
    matcher = new AppSyncMatcher();
  });

  suite('createAppSyncMatcher', () => {
    test('creates an AppSyncMatcher instance', () => {
      const matcher = createAppSyncMatcher();
      expect(matcher).toBeInstanceOf(AppSyncMatcher);
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for a valid AppSync resolver event', () => {
      const event = createAppSyncResolverEvent();
      expect(matcher.canHandleEvent(event)).toBe(true);
    });

    test('returns false for null', () => {
      expect(matcher.canHandleEvent(null)).toBe(false);
    });

    test('returns false for a string', () => {
      expect(matcher.canHandleEvent('not an event')).toBe(false);
    });

    test('returns false when info is missing', () => {
      expect(matcher.canHandleEvent({ arguments: {} })).toBe(false);
    });

    test('returns false when info is not an object', () => {
      expect(matcher.canHandleEvent({ info: 'not-an-object' })).toBe(false);
    });

    test('returns false when parentTypeName is missing', () => {
      expect(matcher.canHandleEvent({ info: { fieldName: 'getUser' } })).toBe(false);
    });

    test('returns false when parentTypeName is not a string', () => {
      expect(matcher.canHandleEvent({ info: { parentTypeName: 123, fieldName: 'getUser' } })).toBe(false);
    });

    test('returns false when fieldName is missing', () => {
      expect(matcher.canHandleEvent({ info: { parentTypeName: 'Query' } })).toBe(false);
    });

    test('returns false when fieldName is not a string', () => {
      expect(matcher.canHandleEvent({ info: { parentTypeName: 'Query', fieldName: 42 } })).toBe(false);
    });

    test('returns true for a list of resolver events', () => {
      const events = [createAppSyncResolverEvent(), createAppSyncResolverEvent()];
      expect(matcher.canHandleEvent(events)).toBe(true);
    });

    test('returns false for an empty list', () => {
      expect(matcher.canHandleEvent([])).toBe(false);
    });

    test('returns false when one entry is not a resolver event', () => {
      const events = [createAppSyncResolverEvent(), { info: { parentTypeName: 'Query' } }];
      expect(matcher.canHandleEvent(events)).toBe(false);
    });
  });

  suite('defineRoute', () => {
    test('preserves filters, argumentsSchema and handler', () => {
      const handler = vi.fn();
      const argumentsSchema = createMockSchema();

      const definition = defineRoute({
        filters: { parentTypeName: 'Query', fieldName: 'getUser' },
        argumentsSchema,
      }).handle(handler);

      expect(definition.filters).toEqual({ parentTypeName: 'Query', fieldName: 'getUser' });
      expect(definition.argumentsSchema).toBe(argumentsSchema);
      expect(definition.handler).toBe(handler);
    });

    test('works without argumentsSchema', () => {
      const handler = vi.fn();

      const definition = defineRoute({
        filters: { parentTypeName: 'Query' },
      }).handle(handler);

      expect(definition.argumentsSchema).toBeUndefined();
      expect(definition.handler).toBe(handler);
    });
  });

  suite('route', () => {
    test('returns this for chaining', () => {
      const handler = vi.fn();

      const result = matcher.route({
        filters: { parentTypeName: 'Query' },
        handler,
      });

      expect(result).toBe(matcher);
    });
  });

  suite('query', () => {
    test('returns this for chaining', () => {
      const result = matcher.query({
        fieldName: 'getUser',
        handler: vi.fn(),
      });

      expect(result).toBe(matcher);
    });
  });

  suite('mutation', () => {
    test('returns this for chaining', () => {
      const result = matcher.mutation({
        fieldName: 'createUser',
        handler: vi.fn(),
      });

      expect(result).toBe(matcher);
    });
  });

  suite('subscription', () => {
    test('returns this for chaining', () => {
      const result = matcher.subscription({
        fieldName: 'onUserCreated',
        handler: vi.fn(),
      });

      expect(result).toBe(matcher);
    });
  });

  suite('matchRoute', () => {
    test('matches by parentTypeName', async () => {
      const handler = vi.fn();
      matcher.route({ filters: { parentTypeName: 'Query' }, handler });

      const event = createAppSyncResolverEvent({ info: { parentTypeName: 'Query' } });

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('Query', 'getUser', event);
      expect(matched).toBeDefined();
      expect(matched?.handler).toBe(handler);
    });

    test('matches by parentTypeName array', async () => {
      const handler = vi.fn();
      matcher.route({ filters: { parentTypeName: ['Query', 'Other'] }, handler });

      const event = createAppSyncResolverEvent({ info: { parentTypeName: 'Query' } });

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('Query', 'getUser', event);
      expect(matched).toBeDefined();
      expect(matched?.handler).toBe(handler);
    });

    test('does not match when parentTypeName is different', async () => {
      matcher.route({ filters: { parentTypeName: 'Query' }, handler: vi.fn() });

      const event = createAppSyncResolverEvent({ info: { parentTypeName: 'Mutation' } });

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('Mutation', 'createUser', event);
      expect(matched).toBeUndefined();
    });

    test('matches by fieldName', async () => {
      const handler = vi.fn();
      matcher.route({ filters: { fieldName: 'getUser' }, handler });

      const event = createAppSyncResolverEvent({ info: { fieldName: 'getUser' } });

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('Query', 'getUser', event);
      expect(matched).toBeDefined();
      expect(matched?.handler).toBe(handler);
    });

    test('matches by fieldName array', async () => {
      const handler = vi.fn();
      matcher.route({ filters: { fieldName: ['getUser', 'createUser'] }, handler });

      const event = createAppSyncResolverEvent({ info: { fieldName: 'getUser' } });

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('Query', 'getUser', event);
      expect(matched).toBeDefined();
      expect(matched?.handler).toBe(handler);
    });

    test('does not match when fieldName is different', async () => {
      matcher.route({ filters: { fieldName: 'getUser' }, handler: vi.fn() });

      const event = createAppSyncResolverEvent({ info: { fieldName: 'listUsers' } });

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('Query', 'listUsers', event);
      expect(matched).toBeUndefined();
    });

    test('matches when custom returns true', async () => {
      const handler = vi.fn();
      matcher.route({ filters: { custom: () => true }, handler });

      const event = createAppSyncResolverEvent();

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('Query', 'getUser', event);
      expect(matched).toBeDefined();
    });

    test('matches when async custom returns true', async () => {
      const handler = vi.fn();
      matcher.route({
        filters: {
          custom: async () => {
            await new Promise((r) => setTimeout(r, 1));
            return true;
          },
        },
        handler,
      });

      const event = createAppSyncResolverEvent();

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('Query', 'getUser', event);
      expect(matched).toBeDefined();
    });

    test('does not match when custom returns false', async () => {
      matcher.route({ filters: { custom: () => false }, handler: vi.fn() });

      const event = createAppSyncResolverEvent();

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('Query', 'getUser', event);
      expect(matched).toBeUndefined();
    });

    test('first route wins when multiple match', async () => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();
      matcher.route({ filters: { parentTypeName: 'Query' }, handler: firstHandler });
      matcher.route({ filters: { parentTypeName: 'Query' }, handler: secondHandler });

      const event = createAppSyncResolverEvent({ info: { parentTypeName: 'Query' } });

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('Query', 'getUser', event);
      expect(matched?.handler).toBe(firstHandler);
    });

    test('orders a narrower route ahead of a broader one registered first', async () => {
      const broad = vi.fn();
      const narrow = vi.fn();
      matcher.route({ filters: { parentTypeName: 'Query' }, handler: broad });
      matcher.route({ filters: { parentTypeName: 'Query', fieldName: 'getUser' }, handler: narrow });

      const event = createAppSyncResolverEvent({ info: { parentTypeName: 'Query' } });

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('Query', 'getUser', event);

      expect(matched?.handler).toBe(narrow);
    });

    test('orders a guarded route ahead of the fallback it shares filters with', async () => {
      const fallback = vi.fn();
      const guarded = vi.fn();
      matcher.route({ filters: { parentTypeName: 'Query' }, handler: fallback });
      matcher.route({ filters: { parentTypeName: 'Query', custom: () => true }, handler: guarded });

      const event = createAppSyncResolverEvent({ info: { parentTypeName: 'Query' } });

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('Query', 'getUser', event);

      expect(matched?.handler).toBe(guarded);
    });

    test('matches when combined filters and custom all pass', async () => {
      const handler = vi.fn();
      matcher.route({
        filters: {
          parentTypeName: 'Query',
          fieldName: 'getUser',
          custom: () => true,
        },
        handler,
      });

      const event = createAppSyncResolverEvent({ info: { parentTypeName: 'Query', fieldName: 'getUser' } });

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('Query', 'getUser', event);
      expect(matched).toBeDefined();
    });

    test('does not match when parentTypeName is an empty string', async () => {
      const handler = vi.fn();
      matcher.route({
        filters: {
          parentTypeName: '',
          fieldName: 'getUser',
          custom: () => true,
        },
        handler,
      });

      const event = createAppSyncResolverEvent({ info: { parentTypeName: 'Query', fieldName: 'getUser' } });

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('Query', 'getUser', event);
      expect(matched).toBeUndefined();
    });

    test('does not match when combined filters pass but custom fails', async () => {
      matcher.route({
        filters: {
          parentTypeName: 'Query',
          fieldName: 'getUser',
          custom: () => false,
        },
        handler: vi.fn(),
      });

      const event = createAppSyncResolverEvent({ info: { parentTypeName: 'Query', fieldName: 'getUser' } });

      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute('Query', 'getUser', event);
      expect(matched).toBeUndefined();
    });
  });

  suite('validateArguments', () => {
    test('returns args unchanged when no schema is provided', async () => {
      const args = { id: '123' };

      const result = await base.validateSchema(args, undefined, 'Query.getUser');
      expect(result).toBe(args);
    });

    test('returns parsed data when schema validation succeeds', async () => {
      const inputData = { id: '123' };
      const schema = createMockSchema();

      const result = await base.validateSchema(inputData, schema, 'Query.getUser');
      expect(result).toEqual(inputData);
    });

    test('throws when schema validation fails', async () => {
      const schema = createMockSchema({ issues: [{ message: 'invalid' }] });

      await expect(
        base.validateSchema({ id: '123' }, schema, 'Arguments validation failed for Query.getUser'),
      ).rejects.toThrow('Arguments validation failed for Query.getUser');
    });
  });

  suite('handleEvent', () => {
    test('builds complete AppSyncResolverRequest and calls handler', async () => {
      const handler = vi.fn().mockResolvedValue({ id: '123', name: 'Test' });
      matcher.route({
        filters: { parentTypeName: 'Query', fieldName: 'getUser' },
        handler,
      });

      const event = createAppSyncResolverEvent({
        arguments: { id: '123' },
        info: { parentTypeName: 'Query', fieldName: 'getUser' },
        request: { headers: { authorization: 'Bearer token' } },
      });
      const context = createMockContext();

      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual({ id: '123', name: 'Test' });
      expect(handler).toHaveBeenCalledOnce();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          arguments: { id: '123' },
          identity: undefined,
          source: null,
          info: expect.objectContaining({ parentTypeName: 'Query', fieldName: 'getUser' }),
          headers: { authorization: 'Bearer token' },
          domainName: null,
          prev: null,
          stash: {},
          event,
          context,
        }),
      );
    });

    test('throws when no route matches', async () => {
      const event = createAppSyncResolverEvent({
        info: { parentTypeName: 'Query', fieldName: 'unknownField' },
      });
      const context = createMockContext();

      await expect(matcher.handleEvent(event, context)).rejects.toThrow('No route matched for Query.unknownField');
    });

    test('validates arguments with schema before calling handler', async () => {
      const handler = vi.fn().mockResolvedValue('ok');
      const argumentsSchema = createMockSchema();
      matcher.route({
        filters: { parentTypeName: 'Query', fieldName: 'getUser' },
        argumentsSchema,
        handler,
      });

      const event = createAppSyncResolverEvent({
        arguments: { id: '123' },
        info: { parentTypeName: 'Query', fieldName: 'getUser' },
      });
      const context = createMockContext();

      await matcher.handleEvent(event, context);

      expect(validateSchemaSpy).toHaveBeenCalledWith(event.arguments, argumentsSchema, expect.any(String));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ arguments: { id: '123' } }));
    });

    test('throws when schema validation fails', async () => {
      const argumentsSchema = createMockSchema({ issues: [{ message: 'invalid' }] });
      matcher.route({
        filters: { parentTypeName: 'Query', fieldName: 'getUser' },
        argumentsSchema,
        handler: vi.fn(),
      });

      const event = createAppSyncResolverEvent({
        info: { parentTypeName: 'Query', fieldName: 'getUser' },
      });
      const context = createMockContext();

      await expect(matcher.handleEvent(event, context)).rejects.toThrow(
        'Arguments validation failed for Query.getUser',
      );
    });
  });

  suite('custom via shorthand methods', () => {
    test('query passes custom to route filters', async () => {
      const custom = vi.fn().mockReturnValue(true);
      const handler = vi.fn().mockResolvedValue('ok');
      matcher.query({
        fieldName: 'getUser',
        filters: { custom },
        handler,
      });

      const event = createAppSyncResolverEvent({
        info: { parentTypeName: 'Query', fieldName: 'getUser' },
      });
      const context = createMockContext();

      await matcher.handleEvent(event, context);

      expect(custom).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledOnce();
    });

    test('query rejects when custom returns false', async () => {
      matcher.query({
        fieldName: 'getUser',
        filters: { custom: () => false },
        handler: vi.fn(),
      });

      const event = createAppSyncResolverEvent({
        info: { parentTypeName: 'Query', fieldName: 'getUser' },
      });
      const context = createMockContext();

      await expect(matcher.handleEvent(event, context)).rejects.toThrow('No route matched');
    });

    test('mutation passes custom to route filters', async () => {
      const custom = vi.fn().mockReturnValue(true);
      const handler = vi.fn().mockResolvedValue('ok');
      matcher.mutation({
        fieldName: 'createUser',
        filters: { custom },
        handler,
      });

      const event = createAppSyncResolverEvent({
        info: { parentTypeName: 'Mutation', fieldName: 'createUser' },
      });
      const context = createMockContext();

      await matcher.handleEvent(event, context);

      expect(custom).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledOnce();
    });

    test('mutation rejects when custom returns false', async () => {
      matcher.mutation({
        fieldName: 'createUser',
        filters: { custom: () => false },
        handler: vi.fn(),
      });

      const event = createAppSyncResolverEvent({
        info: { parentTypeName: 'Mutation', fieldName: 'createUser' },
      });
      const context = createMockContext();

      await expect(matcher.handleEvent(event, context)).rejects.toThrow('No route matched');
    });

    test('subscription passes custom to route filters', async () => {
      const custom = vi.fn().mockReturnValue(true);
      const handler = vi.fn().mockResolvedValue('ok');
      matcher.subscription({
        fieldName: 'onUserCreated',
        filters: { custom },
        handler,
      });

      const event = createAppSyncResolverEvent({
        info: { parentTypeName: 'Subscription', fieldName: 'onUserCreated' },
      });
      const context = createMockContext();

      await matcher.handleEvent(event, context);

      expect(custom).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledOnce();
    });

    test('subscription rejects when custom returns false', async () => {
      matcher.subscription({
        fieldName: 'onUserCreated',
        filters: { custom: () => false },
        handler: vi.fn(),
      });

      const event = createAppSyncResolverEvent({
        info: { parentTypeName: 'Subscription', fieldName: 'onUserCreated' },
      });
      const context = createMockContext();

      await expect(matcher.handleEvent(event, context)).rejects.toThrow('No route matched');
    });
  });

  suite('handleEvent via shorthand methods', () => {
    test('routes Query events through query()', async () => {
      const handler = vi.fn().mockResolvedValue('query-result');
      matcher.query({ fieldName: 'getUser', handler });

      const event = createAppSyncResolverEvent({
        info: { parentTypeName: 'Query', fieldName: 'getUser' },
      });
      const context = createMockContext();

      const result = await matcher.handleEvent(event, context);
      expect(result).toBe('query-result');
    });

    test('routes Mutation events through mutation()', async () => {
      const handler = vi.fn().mockResolvedValue('mutation-result');
      matcher.mutation({ fieldName: 'createUser', handler });

      const event = createAppSyncResolverEvent({
        info: { parentTypeName: 'Mutation', fieldName: 'createUser' },
      });
      const context = createMockContext();

      const result = await matcher.handleEvent(event, context);
      expect(result).toBe('mutation-result');
    });

    test('routes Subscription events through subscription()', async () => {
      const handler = vi.fn().mockResolvedValue('subscription-result');
      matcher.subscription({ fieldName: 'onUserCreated', handler });

      const event = createAppSyncResolverEvent({
        info: { parentTypeName: 'Subscription', fieldName: 'onUserCreated' },
      });
      const context = createMockContext();

      const result = await matcher.handleEvent(event, context);
      expect(result).toBe('subscription-result');
    });
  });

  suite('matcher-level middleware', () => {
    test('executes middleware before the route handler', async () => {
      const callOrder: string[] = [];

      async function middleware(request: AppSyncResolverRequest, next: AppSyncNext): Promise<unknown> {
        callOrder.push('mw-pre');
        const result = await next(request);
        callOrder.push('mw-post');
        return result;
      }

      const matcher = createAppSyncMatcher({ middleware: [middleware] });
      matcher.query({
        fieldName: 'getUser',
        handler: async () => {
          callOrder.push('handler');
          return { id: '1' };
        },
      });

      const event = createAppSyncResolverEvent({
        info: { parentTypeName: 'Query', fieldName: 'getUser' },
      });
      await matcher.handleEvent(event, createMockContext());

      expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
    });

    test('allows middleware to short-circuit with an early return', async () => {
      const handler = vi.fn().mockResolvedValue({ id: '1' });

      async function blockingMiddleware(_request: AppSyncResolverRequest, _next: AppSyncNext): Promise<unknown> {
        return { error: 'Unauthorized' };
      }

      const matcher = createAppSyncMatcher({ middleware: [blockingMiddleware] });
      matcher.query({ fieldName: 'getUser', handler });

      const event = createAppSyncResolverEvent({
        info: { parentTypeName: 'Query', fieldName: 'getUser' },
      });
      const result = await matcher.handleEvent(event, createMockContext());

      expect(result).toEqual({ error: 'Unauthorized' });
      expect(handler).not.toHaveBeenCalled();
    });

    test('does not execute middleware when schema validation fails', async () => {
      const middleware = vi.fn();
      const argumentsSchema = createMockSchema({ issues: [{ message: 'invalid' }] });

      const matcher = createAppSyncMatcher({ middleware: [middleware] });
      matcher.query({ fieldName: 'getUser', argumentsSchema, handler: vi.fn() });

      const event = createAppSyncResolverEvent({
        info: { parentTypeName: 'Query', fieldName: 'getUser' },
      });

      await expect(matcher.handleEvent(event, createMockContext())).rejects.toThrow(
        'Arguments validation failed for Query.getUser',
      );
      expect(middleware).not.toHaveBeenCalled();
    });

    test('executes multiple matcher-level middleware in order', async () => {
      const callOrder: string[] = [];

      async function middlewareOne(request: AppSyncResolverRequest, next: AppSyncNext): Promise<unknown> {
        callOrder.push('mw1-pre');
        const result = await next(request);
        callOrder.push('mw1-post');
        return result;
      }

      async function middlewareTwo(request: AppSyncResolverRequest, next: AppSyncNext): Promise<unknown> {
        callOrder.push('mw2-pre');
        const result = await next(request);
        callOrder.push('mw2-post');
        return result;
      }

      const matcher = createAppSyncMatcher({ middleware: [middlewareOne, middlewareTwo] });
      matcher.query({
        fieldName: 'getUser',
        handler: async () => {
          callOrder.push('handler');
          return { id: '1' };
        },
      });

      const event = createAppSyncResolverEvent({
        info: { parentTypeName: 'Query', fieldName: 'getUser' },
      });
      await matcher.handleEvent(event, createMockContext());

      expect(callOrder).toEqual(['mw1-pre', 'mw2-pre', 'handler', 'mw2-post', 'mw1-post']);
    });

    test('allows middleware to modify the result', async () => {
      async function middleware(request: AppSyncResolverRequest, next: AppSyncNext): Promise<unknown> {
        const result = await next(request);
        return { ...(result as Record<string, unknown>), cached: true };
      }

      const matcher = createAppSyncMatcher({ middleware: [middleware] });
      matcher.query({
        fieldName: 'getUser',
        handler: async () => ({ id: '1', name: 'Alice' }),
      });

      const event = createAppSyncResolverEvent({
        info: { parentTypeName: 'Query', fieldName: 'getUser' },
      });
      const result = await matcher.handleEvent(event, createMockContext());

      expect(result).toEqual({ id: '1', name: 'Alice', cached: true });
    });
  });

  suite('route-level middleware', () => {
    test('executes route-level middleware via query convenience method', async () => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: AppSyncResolverRequest, next: AppSyncNext): Promise<unknown> {
        callOrder.push('route-mw');
        return next(request);
      }

      matcher.query({
        fieldName: 'getUser',
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
          return { id: '1' };
        },
      });

      const event = createAppSyncResolverEvent({
        info: { parentTypeName: 'Query', fieldName: 'getUser' },
      });
      await matcher.handleEvent(event, createMockContext());

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });

    test('allows route-level middleware to short-circuit by not calling next', async () => {
      const handler = vi.fn().mockResolvedValue({ id: '1' });

      async function blockingRouteMiddleware(_request: AppSyncResolverRequest, _next: AppSyncNext): Promise<unknown> {
        return { error: 'Blocked' };
      }

      matcher.query({
        fieldName: 'getUser',
        middleware: [blockingRouteMiddleware],
        handler,
      });

      const event = createAppSyncResolverEvent({
        info: { parentTypeName: 'Query', fieldName: 'getUser' },
      });
      const result = await matcher.handleEvent(event, createMockContext());

      expect(result).toEqual({ error: 'Blocked' });
      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple route-level middleware in order', async () => {
      const callOrder: string[] = [];

      async function routeMiddlewareOne(request: AppSyncResolverRequest, next: AppSyncNext): Promise<unknown> {
        callOrder.push('route-mw1');
        return next(request);
      }

      async function routeMiddlewareTwo(request: AppSyncResolverRequest, next: AppSyncNext): Promise<unknown> {
        callOrder.push('route-mw2');
        return next(request);
      }

      matcher.query({
        fieldName: 'getUser',
        middleware: [routeMiddlewareOne, routeMiddlewareTwo],
        handler: async () => {
          callOrder.push('handler');
          return { id: '1' };
        },
      });

      const event = createAppSyncResolverEvent({
        info: { parentTypeName: 'Query', fieldName: 'getUser' },
      });
      await matcher.handleEvent(event, createMockContext());

      expect(callOrder).toEqual(['route-mw1', 'route-mw2', 'handler']);
    });

    test('supports middleware on defineRoute builder pattern', async () => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: AppSyncResolverRequest, next: AppSyncNext): Promise<unknown> {
        callOrder.push('route-mw');
        return next(request);
      }

      const route = defineRoute({
        filters: { parentTypeName: 'Query', fieldName: 'getUser' },
        middleware: [routeMiddleware],
      }).handle(async () => {
        callOrder.push('handler');
        return { id: '1' };
      });

      matcher.route(route);

      const event = createAppSyncResolverEvent({
        info: { parentTypeName: 'Query', fieldName: 'getUser' },
      });
      await matcher.handleEvent(event, createMockContext());

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });
  });

  suite('combined matcher and route middleware', () => {
    test('executes matcher middleware before route middleware', async () => {
      const callOrder: string[] = [];

      async function matcherMiddleware(request: AppSyncResolverRequest, next: AppSyncNext): Promise<unknown> {
        callOrder.push('matcher-mw');
        return next(request);
      }

      async function routeMiddleware(request: AppSyncResolverRequest, next: AppSyncNext): Promise<unknown> {
        callOrder.push('route-mw');
        return next(request);
      }

      const matcher = createAppSyncMatcher({ middleware: [matcherMiddleware] });
      matcher.mutation({
        fieldName: 'createUser',
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
          return { id: '1' };
        },
      });

      const event = createAppSyncResolverEvent({
        info: { parentTypeName: 'Mutation', fieldName: 'createUser' },
      });
      await matcher.handleEvent(event, createMockContext());

      expect(callOrder).toEqual(['matcher-mw', 'route-mw', 'handler']);
    });

    test('matcher middleware short-circuit prevents route middleware from running', async () => {
      const routeMiddleware = vi.fn();
      const handler = vi.fn();

      async function blockingMatcherMiddleware(_request: AppSyncResolverRequest, _next: AppSyncNext): Promise<unknown> {
        return { error: 'Blocked' };
      }

      const matcher = createAppSyncMatcher({ middleware: [blockingMatcherMiddleware] });
      matcher.query({
        fieldName: 'getUser',
        middleware: [routeMiddleware],
        handler,
      });

      const event = createAppSyncResolverEvent({
        info: { parentTypeName: 'Query', fieldName: 'getUser' },
      });
      await matcher.handleEvent(event, createMockContext());

      expect(routeMiddleware).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  suite('batched resolvers', () => {
    function batchEvent(sourceId: string): AppSyncResolverEvent<Record<string, unknown>> {
      return createAppSyncResolverEvent({
        info: { parentTypeName: 'Post', fieldName: 'relatedPosts' },
        source: { id: sourceId },
      });
    }

    test('routes every entry and returns the results in order under data', async () => {
      matcher.route(
        defineRoute({ filters: { parentTypeName: 'Post', fieldName: 'relatedPosts' } }).handle(async ({ source }) => [
          { id: `related-to-${String(source?.id)}` },
        ]),
      );

      const results = await matcher.handleEvent([batchEvent('1'), batchEvent('2')], createMockContext());

      expect(results).toEqual([{ data: [{ id: 'related-to-1' }] }, { data: [{ id: 'related-to-2' }] }]);
    });

    test('runs middleware once per entry', async () => {
      const middleware = vi.fn(async (request: AppSyncResolverRequest, next: AppSyncNext) => next(request));

      const matcher = createAppSyncMatcher({ middleware: [middleware] });
      matcher.route(defineRoute({ filters: { parentTypeName: 'Post' } }).handle(async () => null));

      await matcher.handleEvent([batchEvent('1'), batchEvent('2'), batchEvent('3')], createMockContext());

      expect(middleware).toHaveBeenCalledTimes(3);
    });

    test('sends entries to different routes when a custom filter tells them apart', async () => {
      matcher
        .route(
          defineRoute({
            filters: {
              parentTypeName: 'Post',
              custom: ({ event }: AppSyncResolverFilterInput) => event.source?.id === '1',
            },
          }).handle(async () => 'first'),
        )
        .route(defineRoute({ filters: { parentTypeName: 'Post' } }).handle(async () => 'rest'));

      const results = await matcher.handleEvent([batchEvent('1'), batchEvent('2')], createMockContext());

      expect(results).toEqual([{ data: 'first' }, { data: 'rest' }]);
    });

    test('fails the whole batch when an entry throws', async () => {
      matcher.route(
        defineRoute({ filters: { parentTypeName: 'Post' } }).handle(async ({ source }) => {
          if (source?.id === '2') throw new Error('Post 2 is gone');
          return 'ok';
        }),
      );

      await expect(matcher.handleEvent([batchEvent('1'), batchEvent('2')], createMockContext())).rejects.toThrow(
        'Post 2 is gone',
      );
    });

    test('reports a failing entry on its own when batchItemFailures is on', async () => {
      const matcher = createAppSyncMatcher({ batchItemFailures: true });
      matcher.route(
        defineRoute({ filters: { parentTypeName: 'Post' } }).handle(async ({ source }) => {
          if (source?.id === '2') throw new Error('Post 2 is gone');
          return 'ok';
        }),
      );

      const results = await matcher.handleEvent(
        [batchEvent('1'), batchEvent('2'), batchEvent('3')],
        createMockContext(),
      );

      expect(results).toEqual([
        { data: 'ok' },
        { data: null, errorMessage: 'Post 2 is gone', errorType: 'Error' },
        { data: 'ok' },
      ]);
    });

    test('names a thrown non-error as Error', async () => {
      const matcher = createAppSyncMatcher({ batchItemFailures: true });
      matcher.route(
        defineRoute({ filters: { parentTypeName: 'Post' } }).handle(async () => {
          throw 'the shelf fell over';
        }),
      );

      const results = await matcher.handleEvent([batchEvent('1')], createMockContext());

      expect(results).toEqual([{ data: null, errorMessage: 'the shelf fell over', errorType: 'Error' }]);
    });

    test('reports an entry that matched no route', async () => {
      const matcher = createAppSyncMatcher({ batchItemFailures: true });
      matcher.route(
        defineRoute({
          filters: {
            parentTypeName: 'Post',
            custom: ({ event }: AppSyncResolverFilterInput) => event.source?.id === '1',
          },
        }).handle(async () => 'ok'),
      );

      const results = await matcher.handleEvent([batchEvent('1'), batchEvent('2')], createMockContext());

      expect(results).toEqual([
        { data: 'ok' },
        { data: null, errorMessage: 'No route matched for Post.relatedPosts', errorType: 'Error' },
      ]);
    });

    test('names the schema in errorType when an entry fails validation', async () => {
      const argumentsSchema = createMockSchema();
      validateSchemaSpy.mockImplementationOnce(async (data: unknown) => data);
      validateSchemaSpy.mockImplementationOnce(async () => {
        throw new base.SchemaValidationError('Arguments validation failed for Post.relatedPosts', []);
      });

      const matcher = createAppSyncMatcher({ batchItemFailures: true });
      matcher.route(defineRoute({ filters: { parentTypeName: 'Post' }, argumentsSchema }).handle(async () => 'ok'));

      const results = await matcher.handleEvent([batchEvent('1'), batchEvent('2')], createMockContext());

      expect(results).toEqual([
        { data: 'ok' },
        {
          data: null,
          errorMessage: 'Arguments validation failed for Post.relatedPosts',
          errorType: 'SchemaValidationError',
        },
      ]);
    });
  });
});

suite('AppSyncMatcher.canHandleEvent', () => {
  const ownEvents = ['createAppSyncResolverEvent'];

  test.each(allEventBuilders())('%s', async (name, build) => {
    const event = build();
    const isOwnEvent = ownEvents.includes(name);

    const claimed = await createAppSyncMatcher().canHandleEvent(event);

    expect(claimed).toBe(isOwnEvent);
  });
});
