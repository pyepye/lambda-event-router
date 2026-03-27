import * as base from '@lambda-event-router/base';
import { createAppSyncResolverEvent, createMockContext, createMockSchema, test } from '@lambda-event-router/testing';
import type { MockInstance } from 'vitest';
import { AppSyncRouter, createAppSyncRouter, defineRoute } from './AppSyncRouter.js';

const validateSchemaSpy: MockInstance = vi.spyOn(base, 'validateSchema');

suite('AppSyncRouter', () => {
  let router: AppSyncRouter;

  beforeEach(() => {
    router = new AppSyncRouter();
  });

  suite('createAppSyncRouter', () => {
    test('creates an AppSyncRouter instance', () => {
      const router = createAppSyncRouter();
      expect(router).toBeInstanceOf(AppSyncRouter);
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for a valid AppSync resolver event', () => {
      const event = createAppSyncResolverEvent();
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns false for null', () => {
      expect(router.canHandleEvent(null)).toBe(false);
    });

    test('returns false for a string', () => {
      expect(router.canHandleEvent('not an event')).toBe(false);
    });

    test('returns false when info is missing', () => {
      expect(router.canHandleEvent({ arguments: {} })).toBe(false);
    });

    test('returns false when info is not an object', () => {
      expect(router.canHandleEvent({ info: 'not-an-object' })).toBe(false);
    });

    test('returns false when parentTypeName is missing', () => {
      expect(router.canHandleEvent({ info: { fieldName: 'getUser' } })).toBe(false);
    });

    test('returns false when parentTypeName is not a string', () => {
      expect(router.canHandleEvent({ info: { parentTypeName: 123, fieldName: 'getUser' } })).toBe(false);
    });

    test('returns false when fieldName is missing', () => {
      expect(router.canHandleEvent({ info: { parentTypeName: 'Query' } })).toBe(false);
    });

    test('returns false when fieldName is not a string', () => {
      expect(router.canHandleEvent({ info: { parentTypeName: 'Query', fieldName: 42 } })).toBe(false);
    });
  });

  suite('defineRoute', () => {
    test('preserves filters, argumentsSchema and handler', () => {
      const handler = vi.fn();
      const argumentsSchema = createMockSchema();

      const definition = defineRoute({
        filters: { parentTypeNames: ['Query'], fieldNames: ['getUser'] },
        argumentsSchema,
      }).handle(handler);

      expect(definition.filters).toEqual({ parentTypeNames: ['Query'], fieldNames: ['getUser'] });
      expect(definition.argumentsSchema).toBe(argumentsSchema);
      expect(definition.handler).toBe(handler);
    });

    test('works without argumentsSchema', () => {
      const handler = vi.fn();

      const definition = defineRoute({
        filters: { parentTypeNames: ['Query'] },
      }).handle(handler);

      expect(definition.argumentsSchema).toBeUndefined();
      expect(definition.handler).toBe(handler);
    });
  });

  suite('route', () => {
    test('returns this for chaining', () => {
      const handler = vi.fn();

      const result = router.route({
        filters: { parentTypeNames: ['Query'] },
        handler,
      });

      expect(result).toBe(router);
    });
  });

  suite('query', () => {
    test('returns this for chaining', () => {
      const result = router.query({
        fieldName: 'getUser',
        handler: vi.fn(),
      });

      expect(result).toBe(router);
    });
  });

  suite('mutation', () => {
    test('returns this for chaining', () => {
      const result = router.mutation({
        fieldName: 'createUser',
        handler: vi.fn(),
      });

      expect(result).toBe(router);
    });
  });

  suite('subscription', () => {
    test('returns this for chaining', () => {
      const result = router.subscription({
        fieldName: 'onUserCreated',
        handler: vi.fn(),
      });

      expect(result).toBe(router);
    });
  });

  suite('matchRoute', () => {
    test('matches by parentTypeNames', () => {
      const handler = vi.fn();
      router.route({ filters: { parentTypeNames: ['Query'] }, handler });

      const event = createAppSyncResolverEvent({ info: { parentTypeName: 'Query' } });

      // @ts-expect-error - testing private method directly
      const matched = router.matchRoute('Query', 'getUser', event);
      expect(matched).toBeDefined();
      expect(matched?.handler).toBe(handler);
    });

    test('does not match when parentTypeName is different', () => {
      router.route({ filters: { parentTypeNames: ['Query'] }, handler: vi.fn() });

      const event = createAppSyncResolverEvent({ info: { parentTypeName: 'Mutation' } });

      // @ts-expect-error - testing private method directly
      const matched = router.matchRoute('Mutation', 'createUser', event);
      expect(matched).toBeUndefined();
    });

    test('matches by fieldNames', () => {
      const handler = vi.fn();
      router.route({ filters: { fieldNames: ['getUser'] }, handler });

      const event = createAppSyncResolverEvent({ info: { fieldName: 'getUser' } });

      // @ts-expect-error - testing private method directly
      const matched = router.matchRoute('Query', 'getUser', event);
      expect(matched).toBeDefined();
      expect(matched?.handler).toBe(handler);
    });

    test('does not match when fieldName is different', () => {
      router.route({ filters: { fieldNames: ['getUser'] }, handler: vi.fn() });

      const event = createAppSyncResolverEvent({ info: { fieldName: 'listUsers' } });

      // @ts-expect-error - testing private method directly
      const matched = router.matchRoute('Query', 'listUsers', event);
      expect(matched).toBeUndefined();
    });

    test('matches when customFilter returns true', () => {
      const handler = vi.fn();
      router.route({ filters: { customFilter: () => true }, handler });

      const event = createAppSyncResolverEvent();

      // @ts-expect-error - testing private method directly
      const matched = router.matchRoute('Query', 'getUser', event);
      expect(matched).toBeDefined();
    });

    test('does not match when customFilter returns false', () => {
      router.route({ filters: { customFilter: () => false }, handler: vi.fn() });

      const event = createAppSyncResolverEvent();

      // @ts-expect-error - testing private method directly
      const matched = router.matchRoute('Query', 'getUser', event);
      expect(matched).toBeUndefined();
    });

    test('first route wins when multiple match', () => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();
      router.route({ filters: { parentTypeNames: ['Query'] }, handler: firstHandler });
      router.route({ filters: { parentTypeNames: ['Query'] }, handler: secondHandler });

      const event = createAppSyncResolverEvent({ info: { parentTypeName: 'Query' } });

      // @ts-expect-error - testing private method directly
      const matched = router.matchRoute('Query', 'getUser', event);
      expect(matched?.handler).toBe(firstHandler);
    });

    test('matches when combined filters and customFilter all pass', () => {
      const handler = vi.fn();
      router.route({
        filters: {
          parentTypeNames: ['Query'],
          fieldNames: ['getUser'],
          customFilter: () => true,
        },
        handler,
      });

      const event = createAppSyncResolverEvent({ info: { parentTypeName: 'Query', fieldName: 'getUser' } });

      // @ts-expect-error - testing private method directly
      const matched = router.matchRoute('Query', 'getUser', event);
      expect(matched).toBeDefined();
    });

    test('does not match when combined filters pass but customFilter fails', () => {
      router.route({
        filters: {
          parentTypeNames: ['Query'],
          fieldNames: ['getUser'],
          customFilter: () => false,
        },
        handler: vi.fn(),
      });

      const event = createAppSyncResolverEvent({ info: { parentTypeName: 'Query', fieldName: 'getUser' } });

      // @ts-expect-error - testing private method directly
      const matched = router.matchRoute('Query', 'getUser', event);
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
      router.route({
        filters: { parentTypeNames: ['Query'], fieldNames: ['getUser'] },
        handler,
      });

      const event = createAppSyncResolverEvent({
        arguments: { id: '123' },
        info: { parentTypeName: 'Query', fieldName: 'getUser' },
        request: { headers: { authorization: 'Bearer token' } },
      });
      const context = createMockContext();

      const result = await router.handleEvent(event, context);

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

      await expect(router.handleEvent(event, context)).rejects.toThrow('No route matched for Query.unknownField');
    });

    test('validates arguments with schema before calling handler', async () => {
      const handler = vi.fn().mockResolvedValue('ok');
      const argumentsSchema = createMockSchema();
      router.route({
        filters: { parentTypeNames: ['Query'], fieldNames: ['getUser'] },
        argumentsSchema,
        handler,
      });

      const event = createAppSyncResolverEvent({
        arguments: { id: '123' },
        info: { parentTypeName: 'Query', fieldName: 'getUser' },
      });
      const context = createMockContext();

      await router.handleEvent(event, context);

      expect(validateSchemaSpy).toHaveBeenCalledWith(event.arguments, argumentsSchema, expect.any(String));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ arguments: { id: '123' } }));
    });

    test('throws when schema validation fails', async () => {
      const argumentsSchema = createMockSchema({ issues: [{ message: 'invalid' }] });
      router.route({
        filters: { parentTypeNames: ['Query'], fieldNames: ['getUser'] },
        argumentsSchema,
        handler: vi.fn(),
      });

      const event = createAppSyncResolverEvent({
        info: { parentTypeName: 'Query', fieldName: 'getUser' },
      });
      const context = createMockContext();

      await expect(router.handleEvent(event, context)).rejects.toThrow('Arguments validation failed for Query.getUser');
    });
  });

  suite('customFilter via shorthand methods', () => {
    test('query passes customFilter to route filters', async () => {
      const customFilter = vi.fn().mockReturnValue(true);
      const handler = vi.fn().mockResolvedValue('ok');
      router.query({
        fieldName: 'getUser',
        filters: { customFilter },
        handler,
      });

      const event = createAppSyncResolverEvent({
        info: { parentTypeName: 'Query', fieldName: 'getUser' },
      });
      const context = createMockContext();

      await router.handleEvent(event, context);

      expect(customFilter).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledOnce();
    });

    test('query rejects when customFilter returns false', async () => {
      router.query({
        fieldName: 'getUser',
        filters: { customFilter: () => false },
        handler: vi.fn(),
      });

      const event = createAppSyncResolverEvent({
        info: { parentTypeName: 'Query', fieldName: 'getUser' },
      });
      const context = createMockContext();

      await expect(router.handleEvent(event, context)).rejects.toThrow('No route matched');
    });

    test('mutation passes customFilter to route filters', async () => {
      const customFilter = vi.fn().mockReturnValue(true);
      const handler = vi.fn().mockResolvedValue('ok');
      router.mutation({
        fieldName: 'createUser',
        filters: { customFilter },
        handler,
      });

      const event = createAppSyncResolverEvent({
        info: { parentTypeName: 'Mutation', fieldName: 'createUser' },
      });
      const context = createMockContext();

      await router.handleEvent(event, context);

      expect(customFilter).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledOnce();
    });

    test('mutation rejects when customFilter returns false', async () => {
      router.mutation({
        fieldName: 'createUser',
        filters: { customFilter: () => false },
        handler: vi.fn(),
      });

      const event = createAppSyncResolverEvent({
        info: { parentTypeName: 'Mutation', fieldName: 'createUser' },
      });
      const context = createMockContext();

      await expect(router.handleEvent(event, context)).rejects.toThrow('No route matched');
    });

    test('subscription passes customFilter to route filters', async () => {
      const customFilter = vi.fn().mockReturnValue(true);
      const handler = vi.fn().mockResolvedValue('ok');
      router.subscription({
        fieldName: 'onUserCreated',
        filters: { customFilter },
        handler,
      });

      const event = createAppSyncResolverEvent({
        info: { parentTypeName: 'Subscription', fieldName: 'onUserCreated' },
      });
      const context = createMockContext();

      await router.handleEvent(event, context);

      expect(customFilter).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledOnce();
    });

    test('subscription rejects when customFilter returns false', async () => {
      router.subscription({
        fieldName: 'onUserCreated',
        filters: { customFilter: () => false },
        handler: vi.fn(),
      });

      const event = createAppSyncResolverEvent({
        info: { parentTypeName: 'Subscription', fieldName: 'onUserCreated' },
      });
      const context = createMockContext();

      await expect(router.handleEvent(event, context)).rejects.toThrow('No route matched');
    });
  });

  suite('handleEvent via shorthand methods', () => {
    test('routes Query events through query()', async () => {
      const handler = vi.fn().mockResolvedValue('query-result');
      router.query({ fieldName: 'getUser', handler });

      const event = createAppSyncResolverEvent({
        info: { parentTypeName: 'Query', fieldName: 'getUser' },
      });
      const context = createMockContext();

      const result = await router.handleEvent(event, context);
      expect(result).toBe('query-result');
    });

    test('routes Mutation events through mutation()', async () => {
      const handler = vi.fn().mockResolvedValue('mutation-result');
      router.mutation({ fieldName: 'createUser', handler });

      const event = createAppSyncResolverEvent({
        info: { parentTypeName: 'Mutation', fieldName: 'createUser' },
      });
      const context = createMockContext();

      const result = await router.handleEvent(event, context);
      expect(result).toBe('mutation-result');
    });

    test('routes Subscription events through subscription()', async () => {
      const handler = vi.fn().mockResolvedValue('subscription-result');
      router.subscription({ fieldName: 'onUserCreated', handler });

      const event = createAppSyncResolverEvent({
        info: { parentTypeName: 'Subscription', fieldName: 'onUserCreated' },
      });
      const context = createMockContext();

      const result = await router.handleEvent(event, context);
      expect(result).toBe('subscription-result');
    });
  });
});
