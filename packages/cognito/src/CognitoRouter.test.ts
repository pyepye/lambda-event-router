import type { Schema } from '@lambda-event-router/base';
import { test } from '@lambda-event-router/testing';
import { CognitoRouter, createCognitoRouter, defineRoute } from './CognitoRouter.js';

suite('CognitoRouter', () => {
  suite('createCognitoRouter', () => {
    test('creates a CognitoRouter instance', () => {
      const router = createCognitoRouter();
      expect(router).toBeInstanceOf(CognitoRouter);
    });
  });

  suite('canHandleEvent', () => {
    let router: CognitoRouter;

    beforeEach(() => {
      router = new CognitoRouter();
    });

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
        filters: { triggerSources: ['PreSignUp_SignUp'] },
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });

    test('handle returns a definition with filters, userAttributesSchema, and handler', () => {
      const handler = vi.fn().mockImplementation(async ({ event }) => event);
      const schema: Schema<{ email: string }> = {
        safeParse: () => ({ success: true, data: { email: 'test@example.com' } }),
      };

      const definition = defineRoute({
        filters: { triggerSources: ['PreSignUp_SignUp'] },
        userAttributesSchema: schema,
      }).handle(handler);

      expect(definition.filters?.triggerSources).toEqual(['PreSignUp_SignUp']);
      expect(definition.userAttributesSchema).toBe(schema);
      expect(definition.handler).toBe(handler);
    });
  });

  suite('route', () => {
    test('returns the router instance for chaining', () => {
      const router = new CognitoRouter();

      const result = router.route({
        handler: vi.fn(),
      });

      expect(result).toBe(router);
    });
  });

  suite('matchRoute', () => {
    let router: CognitoRouter;

    beforeEach(() => {
      router = new CognitoRouter();
    });

    suite('triggerSources filter', () => {
      test('matches when triggerSource is in the list', ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: { triggerSources: ['PreSignUp_SignUp'] },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(event, event.triggerSource);

        expect(result).toBeDefined();
      });

      test('does not match when triggerSource is not in the list', ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: { triggerSources: ['PostConfirmation_ConfirmSignUp'] },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(event, event.triggerSource);

        expect(result).toBeUndefined();
      });

      test('matches when triggerSources filter is undefined', ({ cognitoPreSignUpEvent }) => {
        router.route({
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(event, event.triggerSource);

        expect(result).toBeDefined();
      });
    });

    suite('userPoolIds filter', () => {
      test('matches when userPoolId is in the list', ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: { userPoolIds: ['us-east-1_TestPool'] },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(event, event.triggerSource);

        expect(result).toBeDefined();
      });

      test('does not match when userPoolId is not in the list', ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: { userPoolIds: ['us-west-2_OtherPool'] },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(event, event.triggerSource);

        expect(result).toBeUndefined();
      });

      test('matches when userPoolIds filter is undefined', ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: { triggerSources: ['PreSignUp_SignUp'] },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(event, event.triggerSource);

        expect(result).toBeDefined();
      });
    });

    suite('clientIds filter', () => {
      test('matches when clientId is in the list', ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: { clientIds: ['test-client-id'] },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(event, event.triggerSource);

        expect(result).toBeDefined();
      });

      test('does not match when clientId is not in the list', ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: { clientIds: ['other-client-id'] },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(event, event.triggerSource);

        expect(result).toBeUndefined();
      });

      test('matches when clientIds filter is undefined', ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: { triggerSources: ['PreSignUp_SignUp'] },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(event, event.triggerSource);

        expect(result).toBeDefined();
      });
    });

    suite('userAttributes filter', () => {
      test('matches when all userAttributes pass', ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: { userAttributes: { email: 'test@example.com' } },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(event, event.triggerSource);

        expect(result).toBeDefined();
      });

      test('does not match when a userAttribute fails', ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: { userAttributes: { email: 'other@example.com' } },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(event, event.triggerSource);

        expect(result).toBeUndefined();
      });

      test('does not match when attribute key is not present on event', ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: { userAttributes: { phone: '+1234567890' } },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(event, event.triggerSource);

        expect(result).toBeUndefined();
      });

      test('does not match when one of multiple attributes fails', ({ cognitoPreSignUpEvent }) => {
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
        const result = router.matchRoute(event, event.triggerSource);

        expect(result).toBeUndefined();
      });

      test('skips userAttributes filter for UserMigration events', ({ cognitoUserMigrationEvent }) => {
        router.route({
          filters: { userAttributes: { email: 'test@example.com' } },
          handler: vi.fn(),
        });

        const event = cognitoUserMigrationEvent();
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(event, event.triggerSource);

        expect(result).toBeDefined();
      });

      test('matches when userAttributes filter is undefined', ({ cognitoPreSignUpEvent }) => {
        router.route({
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(event, event.triggerSource);

        expect(result).toBeDefined();
      });
    });

    suite('customFilter', () => {
      test('matches when customFilter returns true', ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: { customFilter: () => true },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(event, event.triggerSource);

        expect(result).toBeDefined();
      });

      test('does not match when customFilter returns false', ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: { customFilter: () => false },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(event, event.triggerSource);

        expect(result).toBeUndefined();
      });

      test('receives correct filterInput args', ({ cognitoPreSignUpEvent }) => {
        const customFilter = vi.fn().mockReturnValue(true);
        router.route({
          filters: { customFilter },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        router.matchRoute(event, event.triggerSource);

        expect(customFilter).toHaveBeenCalledWith({
          triggerSource: 'PreSignUp_SignUp',
          userPoolId: 'us-east-1_TestPool',
          userName: 'test-user',
          callerContext: event.callerContext,
          request: { userAttributes: { email: 'test@example.com' } },
          event,
        });
      });

      test('passes undefined userAttributes in filterInput for UserMigration', ({ cognitoUserMigrationEvent }) => {
        const customFilter = vi.fn().mockReturnValue(true);
        router.route({
          filters: { customFilter },
          handler: vi.fn(),
        });

        const event = cognitoUserMigrationEvent();
        // @ts-expect-error - testing private method directly
        router.matchRoute(event, event.triggerSource);

        expect(customFilter).toHaveBeenCalledWith(
          expect.objectContaining({
            request: { userAttributes: undefined },
          }),
        );
      });
    });

    suite('filter combinations', () => {
      test('does not match when triggerSources matches but userPoolIds does not', ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: {
            triggerSources: ['PreSignUp_SignUp'],
            userPoolIds: ['us-west-2_OtherPool'],
          },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(event, event.triggerSource);

        expect(result).toBeUndefined();
      });

      test('matches when all filters pass together', ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: {
            triggerSources: ['PreSignUp_SignUp'],
            userPoolIds: ['us-east-1_TestPool'],
            clientIds: ['test-client-id'],
            userAttributes: { email: 'test@example.com' },
            customFilter: () => true,
          },
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(event, event.triggerSource);

        expect(result).toBeDefined();
      });
    });

    suite('route selection', () => {
      test('selects the first matching route', ({ cognitoPreSignUpEvent }) => {
        const firstHandler = vi.fn();
        const secondHandler = vi.fn();

        router.route({ handler: firstHandler });
        router.route({ handler: secondHandler });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(event, event.triggerSource);

        expect(result).toBeDefined();
        expect(result?.handler).toBe(firstHandler);
      });

      test('empty filters act as catch-all', ({ cognitoPreSignUpEvent }) => {
        router.route({
          filters: {},
          handler: vi.fn(),
        });

        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(event, event.triggerSource);

        expect(result).toBeDefined();
      });

      test('returns undefined when no routes are registered', ({ cognitoPreSignUpEvent }) => {
        const event = cognitoPreSignUpEvent();
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(event, event.triggerSource);

        expect(result).toBeUndefined();
      });
    });
  });

  suite('handleEvent', () => {
    let router: CognitoRouter;

    beforeEach(() => {
      router = new CognitoRouter();
    });

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
      const transformedAttributes = { email: 'test@example.com', source: 'validated' };
      const schema: Schema<typeof transformedAttributes> = {
        safeParse: () => ({ success: true, data: transformedAttributes }),
      };

      router.route({ userAttributesSchema: schema, handler });

      const event = cognitoPreSignUpEvent();
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          userAttributes: transformedAttributes,
        }),
      );
    });

    test('throws when schema validation fails and does not call handler', async ({
      cognitoPreSignUpEvent,
      context,
    }) => {
      const handler = vi.fn();
      const schema: Schema<Record<string, string>> = {
        safeParse: () => ({ success: false, error: new Error('invalid') }),
      };

      router.route({ userAttributesSchema: schema, handler });

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

      const multiRouter = createCognitoRouter();
      multiRouter
        .preSignUp({ handler: preSignUpHandler })
        .postConfirmation({ handler: postConfirmationHandler })
        .userMigration({ handler: userMigrationHandler });

      const mockContext = context();

      await multiRouter.handleEvent(cognitoPreSignUpEvent(), mockContext);
      expect(preSignUpHandler).toHaveBeenCalledTimes(1);

      await multiRouter.handleEvent(cognitoPostConfirmationEvent(), mockContext);
      expect(postConfirmationHandler).toHaveBeenCalledTimes(1);

      await multiRouter.handleEvent(cognitoUserMigrationEvent(), mockContext);
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

      const challengeRouter = createCognitoRouter();
      challengeRouter
        .defineAuthChallenge({ handler: defineHandler })
        .createAuthChallenge({ handler: createHandler })
        .verifyAuthChallengeResponse({ handler: verifyHandler });

      const mockContext = context();

      await challengeRouter.handleEvent(cognitoDefineAuthChallengeEvent(), mockContext);
      expect(defineHandler).toHaveBeenCalledTimes(1);
      expect(createHandler).not.toHaveBeenCalled();
      expect(verifyHandler).not.toHaveBeenCalled();

      await challengeRouter.handleEvent(cognitoCreateAuthChallengeEvent(), mockContext);
      expect(createHandler).toHaveBeenCalledTimes(1);

      await challengeRouter.handleEvent(cognitoVerifyAuthChallengeResponseEvent(), mockContext);
      expect(verifyHandler).toHaveBeenCalledTimes(1);
    });
  });

  suite('matchUserAttribute', () => {
    let router: CognitoRouter;

    beforeEach(() => {
      router = new CognitoRouter();
    });

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

  suite('validateUserAttributes', () => {
    let router: CognitoRouter;

    beforeEach(() => {
      router = new CognitoRouter();
    });

    test('returns userAttributes unchanged when no schema is provided', () => {
      const userAttributes = { email: 'test@example.com' };

      // @ts-expect-error - testing private method directly
      const result = router.validateUserAttributes(userAttributes, undefined, 'PreSignUp_SignUp');

      expect(result).toBe(userAttributes);
    });

    test('returns validated data on schema success', () => {
      const userAttributes = { email: 'test@example.com' };
      const transformedData = { email: 'test@example.com', source: 'validated' };
      const schema: Schema<typeof transformedData> = {
        safeParse: () => ({ success: true, data: transformedData }),
      };

      // @ts-expect-error - testing private method directly
      const result = router.validateUserAttributes(userAttributes, schema, 'PreSignUp_SignUp');

      expect(result).toEqual(transformedData);
    });

    test('throws with triggerSource in message on schema failure', () => {
      const userAttributes = { email: 'bad' };
      const schema: Schema<unknown> = {
        safeParse: () => ({ success: false, error: new Error('invalid') }),
      };

      expect(() => {
        // @ts-expect-error - testing private method directly
        router.validateUserAttributes(userAttributes, schema, 'PreSignUp_SignUp');
      }).toThrow('User attributes validation failed for trigger PreSignUp_SignUp');
    });
  });
});
