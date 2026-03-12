import type { Schema } from '@lambda-event-router/base';
import { createAppSyncResolverEvent, createMockContext, test } from '@lambda-event-router/testing';
import { AppSyncRouter, createAppSyncRouter, defineRoute } from './AppSyncRouter.js';

suite('AppSyncRouter', () => {
  suite('createAppSyncRouter', () => {
    test('creates an AppSyncRouter instance', () => {
      const router = createAppSyncRouter();
      expect(router).toBeInstanceOf(AppSyncRouter);
    });
  });

  suite('canHandleEvent', () => {
    let router: AppSyncRouter;

    beforeEach(() => {
      router = new AppSyncRouter();
    });

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
      const argumentsSchema: Schema<{ id: string }> = {
        safeParse: vi.fn(),
      };

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
      const router = new AppSyncRouter();
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
      const router = new AppSyncRouter();

      const result = router.query({
        fieldName: 'getUser',
        handler: vi.fn(),
      });

      expect(result).toBe(router);
    });
  });

  suite('mutation', () => {
    test('returns this for chaining', () => {
      const router = new AppSyncRouter();

      const result = router.mutation({
        fieldName: 'createUser',
        handler: vi.fn(),
      });

      expect(result).toBe(router);
    });
  });

  suite('subscription', () => {
    test('returns this for chaining', () => {
      const router = new AppSyncRouter();

      const result = router.subscription({
        fieldName: 'onUserCreated',
        handler: vi.fn(),
      });

      expect(result).toBe(router);
    });
  });

  suite('matchRoute', () => {
    let router: AppSyncRouter;

    beforeEach(() => {
      router = new AppSyncRouter();
    });

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
    let router: AppSyncRouter;

    beforeEach(() => {
      router = new AppSyncRouter();
    });

    test('returns args unchanged when no schema is provided', () => {
      const args = { id: '123' };

      // @ts-expect-error - testing private method directly
      const result = router.validateArguments(args, undefined, 'Query', 'getUser');
      expect(result).toBe(args);
    });

    test('returns parsed data when schema validation succeeds', () => {
      const parsedData = { id: '123', name: 'parsed' };
      const schema: Schema<unknown> = {
        safeParse: vi.fn().mockReturnValue({ success: true, data: parsedData }),
      };

      // @ts-expect-error - testing private method directly
      const result = router.validateArguments({ id: '123' }, schema, 'Query', 'getUser');
      expect(result).toBe(parsedData);
    });

    test('throws when schema validation fails', () => {
      const schema: Schema<unknown> = {
        safeParse: vi.fn().mockReturnValue({ success: false }),
      };

      // @ts-expect-error - testing private method directly
      expect(() => router.validateArguments({ id: '123' }, schema, 'Query', 'getUser')).toThrow(
        'Arguments validation failed for Query.getUser',
      );
    });
  });

  suite('handleEvent', () => {
    test('builds complete AppSyncResolverRequest and calls handler', async () => {
      const router = new AppSyncRouter();
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
      const router = new AppSyncRouter();
      const event = createAppSyncResolverEvent({
        info: { parentTypeName: 'Query', fieldName: 'unknownField' },
      });
      const context = createMockContext();

      await expect(router.handleEvent(event, context)).rejects.toThrow('No route matched for Query.unknownField');
    });

    test('validates arguments with schema before calling handler', async () => {
      const router = new AppSyncRouter();
      const parsedArgs = { id: '123', validated: true };
      const schema: Schema<{ id: string; validated: boolean }> = {
        safeParse: vi.fn().mockReturnValue({ success: true, data: parsedArgs }),
      };
      const handler = vi.fn().mockResolvedValue('ok');

      router.route({
        filters: { parentTypeNames: ['Query'], fieldNames: ['getUser'] },
        argumentsSchema: schema,
        handler,
      });

      const event = createAppSyncResolverEvent({
        arguments: { id: '123' },
        info: { parentTypeName: 'Query', fieldName: 'getUser' },
      });
      const context = createMockContext();

      await router.handleEvent(event, context);

      expect(schema.safeParse).toHaveBeenCalledWith({ id: '123' });
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ arguments: parsedArgs }));
    });

    test('throws when schema validation fails', async () => {
      const router = new AppSyncRouter();
      const schema: Schema<unknown> = {
        safeParse: vi.fn().mockReturnValue({ success: false }),
      };

      router.route({
        filters: { parentTypeNames: ['Query'], fieldNames: ['getUser'] },
        argumentsSchema: schema,
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
      const router = new AppSyncRouter();
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
      const router = new AppSyncRouter();

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
      const router = new AppSyncRouter();
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
      const router = new AppSyncRouter();

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
      const router = new AppSyncRouter();
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
      const router = new AppSyncRouter();

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
      const router = new AppSyncRouter();
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
      const router = new AppSyncRouter();
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
      const router = new AppSyncRouter();
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
