import type { MockInstance } from 'vitest';

import * as base from '@lambda-event-router/base';
import { createMockSchema, test } from '@lambda-event-router/testing';

import { type CognitoRequest, CognitoRouter, createCognitoRouter, defineRoute } from './CognitoRouter.js';
import type { UserAttributes } from './types/common.js';
import type { CognitoEvent } from './types/router.js';

type CognitoNext = (request: CognitoRequest) => Promise<CognitoEvent>;

const validateSchemaSpy: MockInstance = vi.spyOn(base, 'validateSchema');

suite('CognitoRouter', () => {
  let router: CognitoRouter;

  beforeEach(() => {
    router = new CognitoRouter();
  });

  suite('createCognitoRouter', () => {
    test('creates a CognitoRouter instance', () => {
      const router = createCognitoRouter();
      expect(router).toBeInstanceOf(CognitoRouter);
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for a valid Cognito event', () => {
      const event = { triggerSource: 'PreSignUp_SignUp', userPoolId: 'us-east-1_TestPool' };
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns true with extra properties present', () => {
      const event = {
        triggerSource: 'PreSignUp_SignUp',
        userPoolId: 'us-east-1_TestPool',
        userName: 'test-user',
        callerContext: { clientId: 'abc' },
      };
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns false for null', () => {
      expect(router.canHandleEvent(null)).toBe(false);
    });

    test('returns false for a string', () => {
      expect(router.canHandleEvent('not an event')).toBe(false);
    });

    test('returns false when triggerSource is missing', () => {
      const event = { userPoolId: 'us-east-1_TestPool' };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false when triggerSource is not a string', () => {
      const event = { triggerSource: 123, userPoolId: 'us-east-1_TestPool' };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false when userPoolId is missing', () => {
      const event = { triggerSource: 'PreSignUp_SignUp' };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false when userPoolId is not a string', () => {
      const event = { triggerSource: 'PreSignUp_SignUp', userPoolId: 42 };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for an SQS-shaped event', () => {
      const event = { Records: [{ eventSource: 'aws:sqs' }] };
      expect(router.canHandleEvent(event)).toBe(false);
    });
  });

  suite('defineRoute', () => {
    test('returns a builder with a handle method', () => {
      const builder = defineRoute({
        filters: { triggerSource: 'PreSignUp_SignUp' },
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });

    test('handle returns a definition with filters, userAttributesSchema, and handler', () => {
      const handler = vi.fn().mockImplementation(async ({ event }) => event);
      const userAttributesSchema = createMockSchema();

      const definition = defineRoute({
        filters: { triggerSource: 'PreSignUp_SignUp' },
        userAttributesSchema,
      }).handle(handler);

      expect(definition.filters?.triggerSource).toEqual('PreSignUp_SignUp');
      expect(definition.userAttributesSchema).toBe(userAttributesSchema);
      expect(definition.handler).toBe(handler);
    });
  });

  suite('route', () => {
    test('returns the router instance for chaining', () => {
      const result = router.route({
        handler: vi.fn(),
      });

      expect(result).toBe(router);
    });
  });

  suite('matchRoute', () => {
    suite('triggerSource filter', () => {
      test('matches when triggerSource is in the list', async ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: { triggerSource: 'PreSignUp_SignUp' },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = await router.matchRoute(event, event.triggerSource);

        expect(result).toBeDefined();
      });

      test('matches when triggerSource array', async ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: { triggerSource: ['PreSignUp_SignUp', 'PostConfirmation_ConfirmSignUp'] },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = await router.matchRoute(event, event.triggerSource);

        expect(result).toBeDefined();
      });

      test('does not match when triggerSource is not in the list', async ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: { triggerSource: 'PostConfirmation_ConfirmSignUp' },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = await router.matchRoute(event, event.triggerSource);

        expect(result).toBeUndefined();
      });

      test('matches when triggerSource filter is undefined', async ({ cognitoPreSignUpEvent }) => {
        router.route({
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = await router.matchRoute(event, event.triggerSource);

        expect(result).toBeDefined();
      });
    });

    suite('userPoolId filter', () => {
      test('matches when userPoolId is in the list', async ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: { userPoolId: 'us-east-1_TestPool' },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = await router.matchRoute(event, event.triggerSource);

        expect(result).toBeDefined();
      });

      test('matches when userPoolId array', async ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: { userPoolId: ['us-east-1_TestPool', 'us-east-1_OtherPool'] },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = await router.matchRoute(event, event.triggerSource);

        expect(result).toBeDefined();
      });

      test('does not match when userPoolId is not in the list', async ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: { userPoolId: 'us-west-2_OtherPool' },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = await router.matchRoute(event, event.triggerSource);

        expect(result).toBeUndefined();
      });

      test('matches when userPoolId filter is undefined', async ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: { triggerSource: 'PreSignUp_SignUp' },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = await router.matchRoute(event, event.triggerSource);

        expect(result).toBeDefined();
      });
    });

    suite('clientId filter', () => {
      test('matches when clientId is in the list', async ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: { clientId: 'test-client-id' },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = await router.matchRoute(event, event.triggerSource);

        expect(result).toBeDefined();
      });

      test('matches when clientId array', async ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: { clientId: ['test-client-id', 'other-id'] },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = await router.matchRoute(event, event.triggerSource);

        expect(result).toBeDefined();
      });

      test('does not match when clientId is not in the list', async ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: { clientId: ['other-client-id'] },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = await router.matchRoute(event, event.triggerSource);

        expect(result).toBeUndefined();
      });

      test('matches when clientId filter is undefined', async ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: { triggerSource: 'PreSignUp_SignUp' },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = await router.matchRoute(event, event.triggerSource);

        expect(result).toBeDefined();
      });
    });

    suite('userAttributes filter', () => {
      test('matches when all userAttributes pass', async ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: { userAttributes: { email: 'test@example.com' } },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = await router.matchRoute(event, event.triggerSource);

        expect(result).toBeDefined();
      });

      test('does not match when a userAttribute fails', async ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: { userAttributes: { email: 'other@example.com' } },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = await router.matchRoute(event, event.triggerSource);

        expect(result).toBeUndefined();
      });

      test('does not match when attribute key is not present on event', async ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: { userAttributes: { phone: '+1234567890' } },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = await router.matchRoute(event, event.triggerSource);

        expect(result).toBeUndefined();
      });

      test('does not match when one of multiple attributes fails', async ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: {
            userAttributes: {
              email: 'test@example.com',
              phone: '+1234567890',
            },
          },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = await router.matchRoute(event, event.triggerSource);

        expect(result).toBeUndefined();
      });

      test('skips userAttributes filter for UserMigration events', async ({ cognitoUserMigrationEvent }) => {
        router.route({
          filters: { userAttributes: { email: 'test@example.com' } },
          handler: vi.fn(),
        });

        const event = cognitoUserMigrationEvent();
        // @ts-expect-error - testing private method directly
        const result = await router.matchRoute(event, event.triggerSource);

        expect(result).toBeDefined();
      });

      test('matches when userAttributes filter is undefined', async ({ cognitoPreSignUpEvent }) => {
        router.route({
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = await router.matchRoute(event, event.triggerSource);

        expect(result).toBeDefined();
      });
    });

    suite('customFilter', () => {
      test('matches when customFilter returns true', async ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: { customFilter: () => true },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = await router.matchRoute(event, event.triggerSource);

        expect(result).toBeDefined();
      });

      test('does not match when customFilter returns false', async ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: { customFilter: () => false },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = await router.matchRoute(event, event.triggerSource);

        expect(result).toBeUndefined();
      });

      test('receives correct filterInput args', async ({ cognitoPreSignUpEvent }) => {
        const customFilter = vi.fn().mockReturnValue(true);
        router.route({
          filters: { customFilter },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        await router.matchRoute(event, event.triggerSource);

        expect(customFilter).toHaveBeenCalledWith({
          triggerSource: 'PreSignUp_SignUp',
          userPoolId: 'us-east-1_TestPool',
          userName: 'test-user',
          callerContext: event.callerContext,
          request: { userAttributes: { email: 'test@example.com' } },
          event,
        });
      });

      test('passes undefined userAttributes in filterInput for UserMigration', async ({
        cognitoUserMigrationEvent,
      }) => {
        const customFilter = vi.fn().mockReturnValue(true);
        router.route({
          filters: { customFilter },
          handler: vi.fn(),
        });

        const event = cognitoUserMigrationEvent();
        // @ts-expect-error - testing private method directly
        await router.matchRoute(event, event.triggerSource);

        expect(customFilter).toHaveBeenCalledWith(
          expect.objectContaining({
            request: { userAttributes: undefined },
          }),
        );
      });

      test('matches route by async customFilter', async ({ cognitoPreSignUpEvent }) => {
        const asyncFilter = vi.fn().mockResolvedValue(true);
        router.route({
          filters: { customFilter: asyncFilter },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = await router.matchRoute(event, event.triggerSource);

        expect(result).toBeDefined();
        expect(asyncFilter).toHaveBeenCalled();
      });
    });

    suite('filter combinations', () => {
      test('does not match when triggerSource matches but userPoolId does not', async ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: {
            triggerSource: 'PreSignUp_SignUp',
            userPoolId: 'us-west-2_OtherPool',
          },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = await router.matchRoute(event, event.triggerSource);

        expect(result).toBeUndefined();
      });

      test('matches when all filters pass together', async ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: {
            triggerSource: 'PreSignUp_SignUp',
            userPoolId: 'us-east-1_TestPool',
            clientId: 'test-client-id',
            userAttributes: { email: 'test@example.com' },
            customFilter: () => true,
          },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = await router.matchRoute(event, event.triggerSource);

        expect(result).toBeDefined();
      });
    });

    suite('route selection', () => {
      test('selects the first matching route', async ({ cognitoPreSignUpEvent }) => {
        const firstHandler = vi.fn();
        const secondHandler = vi.fn();
        router.route({ handler: firstHandler });
        router.route({ handler: secondHandler });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = await router.matchRoute(event, event.triggerSource);

        expect(result).toBeDefined();
        expect(result?.handler).toBe(firstHandler);
      });

      test('empty filters act as catch-all', async ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: {},
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = await router.matchRoute(event, event.triggerSource);

        expect(result).toBeDefined();
      });

      test('returns undefined when no routes are registered', async ({ cognitoPreSignUpEvent }) => {
        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = await router.matchRoute(event, event.triggerSource);

        expect(result).toBeUndefined();
      });
    });
  });

  suite('handleEvent', () => {
    test('throws "No route matched" with triggerSource when no match', async ({ cognitoPreSignUpEvent, context }) => {
      const event = cognitoPreSignUpEvent();

      await expect(router.handleEvent(event, context())).rejects.toThrow(
        'No route matched for trigger PreSignUp_SignUp',
      );
    });

    test('clones event so original is unchanged after handler mutates', async ({ cognitoPreSignUpEvent, context }) => {
      router.route({
        handler: vi.fn().mockImplementation(async ({ event }) => {
          event.response.autoConfirmUser = true;
          return event;
        }),
      });

      const event = cognitoPreSignUpEvent();
      await router.handleEvent(event, context());

      expect(event.response.autoConfirmUser).toBe(false);
    });

    test('request contains triggerSource, userAttributes, cloned event, and context', async ({
      cognitoPreSignUpEvent,
      context,
    }) => {
      const handler = vi.fn();
      router.route({ handler });

      const event = cognitoPreSignUpEvent();
      const mockContext = context();
      await router.handleEvent(event, mockContext);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          triggerSource: 'PreSignUp_SignUp',
          userAttributes: { email: 'test@example.com' },
          context: mockContext,
        }),
      );

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          event: expect.objectContaining({ triggerSource: event.triggerSource }),
        }),
      );
      const requestEvent = handler.mock.calls[0]?.[0].event;
      expect(requestEvent).not.toBe(event);
    });

    test('uses empty object for userAttributes on UserMigration events', async ({
      cognitoUserMigrationEvent,
      context,
    }) => {
      const handler = vi.fn();
      router.route({ handler });

      const event = cognitoUserMigrationEvent();
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          userAttributes: {},
        }),
      );
    });

    test('handler receives validated userAttributes when schema passes', async ({ cognitoPreSignUpEvent, context }) => {
      const handler = vi.fn();
      const userAttributesSchema = createMockSchema<UserAttributes>();

      router.route({ userAttributesSchema, handler });

      const event = cognitoPreSignUpEvent();
      await router.handleEvent(event, context());

      expect(validateSchemaSpy).toHaveBeenCalledWith(
        event.request.userAttributes,
        userAttributesSchema,
        expect.any(String),
      );
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          userAttributes: event.request.userAttributes,
        }),
      );
    });

    test('throws when schema validation fails and does not call handler', async ({
      cognitoPreSignUpEvent,
      context,
    }) => {
      const handler = vi.fn();
      const userAttributesSchema = createMockSchema<UserAttributes>({ issues: [{ message: 'invalid' }] });

      router.route({ userAttributesSchema, handler });

      const event = cognitoPreSignUpEvent();
      await expect(router.handleEvent(event, context())).rejects.toThrow(
        'User attributes validation failed for trigger PreSignUp_SignUp',
      );
      expect(handler).not.toHaveBeenCalled();
    });

    test('returns value from handler', async ({ cognitoPreSignUpEvent, context }) => {
      router.route({
        handler: vi.fn().mockImplementation(async ({ event }) => {
          event.response.autoConfirmUser = true;
          return event;
        }),
      });

      const event = cognitoPreSignUpEvent();
      const result = await router.handleEvent(event, context());

      expect(result.response).toEqual(expect.objectContaining({ autoConfirmUser: true }));
    });

    test('propagates handler errors', async ({ cognitoPreSignUpEvent, context }) => {
      router.route({
        handler: vi.fn().mockRejectedValue(new Error('handler failed')),
      });

      const event = cognitoPreSignUpEvent();
      await expect(router.handleEvent(event, context())).rejects.toThrow('handler failed');
    });

    test('different handlers for different triggers in the same router', async ({
      cognitoPreSignUpEvent,
      cognitoPostConfirmationEvent,
      cognitoUserMigrationEvent,
      context,
    }) => {
      const preSignUpHandler = vi.fn();
      const postConfirmationHandler = vi.fn();
      const userMigrationHandler = vi.fn();

      router
        .preSignUp({ handler: preSignUpHandler })
        .postConfirmation({ handler: postConfirmationHandler })
        .userMigration({ handler: userMigrationHandler });

      const mockContext = context();

      await router.handleEvent(cognitoPreSignUpEvent(), mockContext);
      expect(preSignUpHandler).toHaveBeenCalledTimes(1);

      await router.handleEvent(cognitoPostConfirmationEvent(), mockContext);
      expect(postConfirmationHandler).toHaveBeenCalledTimes(1);

      await router.handleEvent(cognitoUserMigrationEvent(), mockContext);
      expect(userMigrationHandler).toHaveBeenCalledTimes(1);
    });

    test('auth challenge flow routes to distinct handlers', async ({
      cognitoDefineAuthChallengeEvent,
      cognitoCreateAuthChallengeEvent,
      cognitoVerifyAuthChallengeResponseEvent,
      context,
    }) => {
      const defineHandler = vi.fn();
      const createHandler = vi.fn();
      const verifyHandler = vi.fn();
      router
        .defineAuthChallenge({ handler: defineHandler })
        .createAuthChallenge({ handler: createHandler })
        .verifyAuthChallengeResponse({ handler: verifyHandler });

      const mockContext = context();

      await router.handleEvent(cognitoDefineAuthChallengeEvent(), mockContext);
      expect(defineHandler).toHaveBeenCalledTimes(1);
      expect(createHandler).not.toHaveBeenCalled();
      expect(verifyHandler).not.toHaveBeenCalled();

      await router.handleEvent(cognitoCreateAuthChallengeEvent(), mockContext);
      expect(createHandler).toHaveBeenCalledTimes(1);

      await router.handleEvent(cognitoVerifyAuthChallengeResponseEvent(), mockContext);
      expect(verifyHandler).toHaveBeenCalledTimes(1);
    });
  });

  suite('matchUserAttribute', () => {
    test('matches an exact string value', () => {
      // @ts-expect-error - testing private method directly
      expect(router.matchUserAttribute('test@example.com', 'test@example.com')).toBe(true);
    });

    test('does not match a different string value', () => {
      // @ts-expect-error - testing private method directly
      expect(router.matchUserAttribute('test@example.com', 'other@example.com')).toBe(false);
    });

    test('matches a RegExp pattern', () => {
      // match email domain pattern
      // @ts-expect-error - testing private method directly
      expect(router.matchUserAttribute('test@example.com', /@example\.com$/)).toBe(true);
    });

    test('does not match a non-matching RegExp', () => {
      // @ts-expect-error - testing private method directly
      expect(router.matchUserAttribute('test@example.com', /@other\.com$/)).toBe(false);
    });

    test('matches when function returns true', () => {
      const filter = (value: string): boolean => value.includes('@');
      // @ts-expect-error - testing private method directly
      expect(router.matchUserAttribute('test@example.com', filter)).toBe(true);
    });

    test('does not match when function returns false', () => {
      const filter = (value: string): boolean => value.startsWith('admin');
      // @ts-expect-error - testing private method directly
      expect(router.matchUserAttribute('test@example.com', filter)).toBe(false);
    });

    test('returns false when value is undefined', () => {
      // @ts-expect-error - testing private method directly
      expect(router.matchUserAttribute(undefined, 'test')).toBe(false);
    });
  });

  suite('router-level middleware', () => {
    test('executes middleware before the route handler', async ({ cognitoPreSignUpHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middleware(request: CognitoRequest, next: CognitoNext): Promise<CognitoEvent> {
        callOrder.push('mw-pre');
        const result = await next(request);
        callOrder.push('mw-post');
        return result;
      }

      const router = createCognitoRouter({ middleware: [middleware] });
      router.route({
        filters: {},
        handler: async (request: CognitoRequest) => {
          callOrder.push('handler');
          return request.event;
        },
      });

      const { event, context } = cognitoPreSignUpHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
    });

    test('allows middleware to skip a record by not calling next', async ({ cognitoPreSignUpHandlerEvent }) => {
      const handler = vi.fn();

      async function skipMiddleware(_request: CognitoRequest, _next: CognitoNext): Promise<CognitoEvent> {
        // @ts-expect-error - returning undefined to simulate skipping
        return;
      }

      const router = createCognitoRouter({ middleware: [skipMiddleware] });
      router.route({ filters: {}, handler });

      const { event, context } = cognitoPreSignUpHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple router-level middleware in order', async ({ cognitoPreSignUpHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middlewareOne(request: CognitoRequest, next: CognitoNext): Promise<CognitoEvent> {
        callOrder.push('mw1');
        return next(request);
      }

      async function middlewareTwo(request: CognitoRequest, next: CognitoNext): Promise<CognitoEvent> {
        callOrder.push('mw2');
        return next(request);
      }

      const router = createCognitoRouter({ middleware: [middlewareOne, middlewareTwo] });
      router.route({
        filters: {},
        handler: async (request: CognitoRequest) => {
          callOrder.push('handler');
          return request.event;
        },
      });

      const { event, context } = cognitoPreSignUpHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw1', 'mw2', 'handler']);
    });
  });

  suite('route-level middleware', () => {
    test('executes route-level middleware for a specific route', async ({ cognitoPreSignUpHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: CognitoRequest, next: CognitoNext): Promise<CognitoEvent> {
        callOrder.push('route-mw');
        return next(request);
      }

      router.route({
        filters: {},
        middleware: [routeMiddleware],
        handler: async (request: CognitoRequest) => {
          callOrder.push('handler');
          return request.event;
        },
      });

      const { event, context } = cognitoPreSignUpHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });

    test('allows route-level middleware to short-circuit by not calling next', async ({
      cognitoPreSignUpHandlerEvent,
    }) => {
      const handler = vi.fn();

      async function blockingRouteMiddleware(_request: CognitoRequest, _next: CognitoNext): Promise<CognitoEvent> {
        // @ts-expect-error - returning undefined to simulate short-circuit
        return;
      }

      router.route({ filters: {}, middleware: [blockingRouteMiddleware], handler });

      const { event, context } = cognitoPreSignUpHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple route-level middleware in order', async ({ cognitoPreSignUpHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddlewareOne(request: CognitoRequest, next: CognitoNext): Promise<CognitoEvent> {
        callOrder.push('route-mw1');
        return next(request);
      }

      async function routeMiddlewareTwo(request: CognitoRequest, next: CognitoNext): Promise<CognitoEvent> {
        callOrder.push('route-mw2');
        return next(request);
      }

      router.route({
        filters: {},
        middleware: [routeMiddlewareOne, routeMiddlewareTwo],
        handler: async (request: CognitoRequest) => {
          callOrder.push('handler');
          return request.event;
        },
      });

      const { event, context } = cognitoPreSignUpHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw1', 'route-mw2', 'handler']);
    });

    test('supports middleware on defineRoute builder pattern', async ({ cognitoPreSignUpHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: CognitoRequest, next: CognitoNext): Promise<CognitoEvent> {
        callOrder.push('route-mw');
        return next(request);
      }

      const route = defineRoute({
        filters: {
          userPoolId: '',
        },
        middleware: [routeMiddleware],
      }).handle(async (request) => {
        callOrder.push('handler');
        return request.event;
      });

      router.route(route);

      const { event, context } = cognitoPreSignUpHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });
  });

  suite('combined router and route middleware', () => {
    test('executes router middleware before route middleware', async ({ cognitoPreSignUpHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routerMiddleware(request: CognitoRequest, next: CognitoNext): Promise<CognitoEvent> {
        callOrder.push('router-mw');
        return next(request);
      }

      async function routeMiddleware(request: CognitoRequest, next: CognitoNext): Promise<CognitoEvent> {
        callOrder.push('route-mw');
        return next(request);
      }

      const router = createCognitoRouter({ middleware: [routerMiddleware] });
      router.route({
        filters: {},
        middleware: [routeMiddleware],
        handler: async (request: CognitoRequest) => {
          callOrder.push('handler');
          return request.event;
        },
      });

      const { event, context } = cognitoPreSignUpHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['router-mw', 'route-mw', 'handler']);
    });

    test('router middleware short-circuit prevents route middleware from running', async ({
      cognitoPreSignUpHandlerEvent,
    }) => {
      const routeMiddleware = vi.fn();
      const handler = vi.fn();

      async function blockingRouterMiddleware(_request: CognitoRequest, _next: CognitoNext): Promise<CognitoEvent> {
        // @ts-expect-error - returning undefined to simulate short-circuit
        return;
      }

      const router = createCognitoRouter({ middleware: [blockingRouterMiddleware] });
      router.route({ filters: {}, middleware: [routeMiddleware], handler });

      const { event, context } = cognitoPreSignUpHandlerEvent();
      await router.handleEvent(event, context);

      expect(routeMiddleware).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  suite('middleware does not run on validation failure', () => {
    test('does not execute middleware when schema validation fails', async ({ cognitoPreSignUpHandlerEvent }) => {
      const middleware = vi.fn();
      const userAttributesSchema = createMockSchema<UserAttributes>({ issues: [{ message: 'invalid' }] });

      const router = createCognitoRouter({ middleware: [middleware] });
      router.route({ filters: {}, userAttributesSchema, handler: vi.fn() });

      const { event, context } = cognitoPreSignUpHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('User attributes validation failed');
      expect(middleware).not.toHaveBeenCalled();
    });
  });
});
