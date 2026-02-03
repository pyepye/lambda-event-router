import { createSecretsManagerRotationEvent, test } from '@lambda-event-router/testing';
import { createSecretsManagerRouter, defineRoute, SecretsManagerRouter } from './SecretsManagerRouter.js';
import type { SecretsManagerFilters, SecretsManagerRequest } from './types.js';

suite('SecretsManagerRouter', () => {
  suite('createSecretsManagerRouter', () => {
    test('creates a SecretsManagerRouter instance', () => {
      const router = createSecretsManagerRouter();
      expect(router).toBeInstanceOf(SecretsManagerRouter);
    });
  });

  suite('canHandleEvent', () => {
    let router: SecretsManagerRouter;

    beforeEach(() => {
      router = new SecretsManagerRouter();
    });

    test.each([
      'createSecret',
      'setSecret',
      'testSecret',
      'finishSecret',
    ] as const)('returns true for %s step', (step) => {
      const event = createSecretsManagerRotationEvent({ Step: step });
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns false for null', () => {
      expect(router.canHandleEvent(null)).toBe(false);
    });

    test('returns false for a string', () => {
      expect(router.canHandleEvent('not an event')).toBe(false);
    });

    test('returns false for an array', () => {
      expect(router.canHandleEvent([1, 2, 3])).toBe(false);
    });

    test('returns false for a non-object', () => {
      expect(router.canHandleEvent(42)).toBe(false);
    });

    test('returns false when SecretId is missing', () => {
      expect(router.canHandleEvent({ ClientRequestToken: 'token', Step: 'createSecret' })).toBe(false);
    });

    test('returns false when SecretId is not a string', () => {
      expect(router.canHandleEvent({ SecretId: 123, ClientRequestToken: 'token', Step: 'createSecret' })).toBe(false);
    });

    test('returns false when ClientRequestToken is missing', () => {
      expect(router.canHandleEvent({ SecretId: 'secret-id', Step: 'createSecret' })).toBe(false);
    });

    test('returns false when ClientRequestToken is not a string', () => {
      expect(router.canHandleEvent({ SecretId: 'secret-id', ClientRequestToken: 123, Step: 'createSecret' })).toBe(
        false,
      );
    });

    test('returns false when Step is missing', () => {
      expect(router.canHandleEvent({ SecretId: 'secret-id', ClientRequestToken: 'token' })).toBe(false);
    });

    test('returns false when Step is not a string', () => {
      expect(router.canHandleEvent({ SecretId: 'secret-id', ClientRequestToken: 'token', Step: 123 })).toBe(false);
    });

    test('returns false when Step is an invalid string value', () => {
      expect(router.canHandleEvent({ SecretId: 'secret-id', ClientRequestToken: 'token', Step: 'invalidStep' })).toBe(
        false,
      );
    });
  });

  suite('defineRoute', () => {
    test('returns a route builder with a handle method', () => {
      const builder = defineRoute({
        filters: { secretIds: ['arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret'] },
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });

    test('preserves filters and handler in the definition', () => {
      const handler = vi.fn();
      const filters: SecretsManagerFilters = {
        secretIds: ['arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret'],
        steps: ['createSecret'],
      };

      const definition = defineRoute({ filters }).handle(handler);

      expect(definition).toEqual({ filters, handler });
    });
  });

  suite('route', () => {
    test('returns the router instance for chaining', () => {
      const router = new SecretsManagerRouter();
      const definition = defineRoute({
        filters: { secretIds: ['arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret'] },
      }).handle(async () => {});

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  suite('step convenience methods', () => {
    test.each([
      'createSecret',
      'setSecret',
      'testSecret',
      'finishSecret',
    ] as const)('%s adds route with correct step filter', (step) => {
      const router = new SecretsManagerRouter();
      const handler = vi.fn();

      router[step]({ filters: {}, handler });

      const request: SecretsManagerRequest = {
        secretId: 'my-secret',
        clientRequestToken: 'token',
        step,
      };
      // @ts-expect-error - testing private method directly
      const matched = router.matchRoute(request);
      expect(matched).toBeDefined();
    });

    test('preserves other filters alongside injected steps', () => {
      const router = new SecretsManagerRouter();
      const handler = vi.fn();
      const secretId = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret';

      router.createSecret({ filters: { secretIds: [secretId] }, handler });

      const matchingRequest: SecretsManagerRequest = {
        secretId,
        clientRequestToken: 'token',
        step: 'createSecret',
      };
      // @ts-expect-error - testing private method directly
      const matched = router.matchRoute(matchingRequest);
      expect(matched).toBeDefined();

      const nonMatchingRequest: SecretsManagerRequest = {
        secretId: 'other-secret',
        clientRequestToken: 'token',
        step: 'createSecret',
      };
      // @ts-expect-error - testing private method directly
      const notMatched = router.matchRoute(nonMatchingRequest);
      expect(notMatched).toBeUndefined();
    });

    test('returns this for chaining', () => {
      const router = new SecretsManagerRouter();
      const handler = vi.fn();

      const result = router.createSecret({ filters: {}, handler });

      expect(result).toBe(router);
    });
  });

  suite('matchRoute', () => {
    let router: SecretsManagerRouter;

    beforeEach(() => {
      router = createSecretsManagerRouter();
    });

    suite('secretIds', () => {
      test('matches when secretId is in the list', () => {
        const secretId = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret';
        router.route(defineRoute({ filters: { secretIds: [secretId] } }).handle(async () => {}));

        const request: SecretsManagerRequest = { secretId, clientRequestToken: 'token', step: 'createSecret' };
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(request);
        expect(result).toBeDefined();
      });

      test('does not match when secretId is not in the list', () => {
        router.route(
          defineRoute({
            filters: { secretIds: ['arn:aws:secretsmanager:us-east-1:123456789012:secret:other'] },
          }).handle(async () => {}),
        );

        const request: SecretsManagerRequest = {
          secretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(request);
        expect(result).toBeUndefined();
      });

      test('matches when secretId is one of multiple allowed', () => {
        const secretIdA = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:secret-a';
        const secretIdB = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:secret-b';
        router.route(defineRoute({ filters: { secretIds: [secretIdA, secretIdB] } }).handle(async () => {}));

        const request: SecretsManagerRequest = {
          secretId: secretIdB,
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(request);
        expect(result).toBeDefined();
      });
    });

    suite('secretPrefixes', () => {
      test('matches when secretId starts with prefix', () => {
        router.route(
          defineRoute({ filters: { secretPrefixes: ['arn:aws:secretsmanager:us-east-1'] } }).handle(async () => {}),
        );

        const request: SecretsManagerRequest = {
          secretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(request);
        expect(result).toBeDefined();
      });

      test('does not match when secretId does not start with prefix', () => {
        router.route(
          defineRoute({ filters: { secretPrefixes: ['arn:aws:secretsmanager:eu-west-1'] } }).handle(async () => {}),
        );

        const request: SecretsManagerRequest = {
          secretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(request);
        expect(result).toBeUndefined();
      });

      test('matches when secretId starts with one of multiple prefixes', () => {
        router.route(
          defineRoute({
            filters: { secretPrefixes: ['arn:aws:secretsmanager:eu-west-1', 'arn:aws:secretsmanager:us-east-1'] },
          }).handle(async () => {}),
        );

        const request: SecretsManagerRequest = {
          secretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(request);
        expect(result).toBeDefined();
      });
    });

    suite('secretSuffixes', () => {
      test('matches when secretId ends with suffix', () => {
        router.route(defineRoute({ filters: { secretSuffixes: ['my-secret'] } }).handle(async () => {}));

        const request: SecretsManagerRequest = {
          secretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(request);
        expect(result).toBeDefined();
      });

      test('does not match when secretId does not end with suffix', () => {
        router.route(defineRoute({ filters: { secretSuffixes: ['other-secret'] } }).handle(async () => {}));

        const request: SecretsManagerRequest = {
          secretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(request);
        expect(result).toBeUndefined();
      });

      test('matches when secretId ends with one of multiple suffixes', () => {
        router.route(
          defineRoute({ filters: { secretSuffixes: ['other-secret', 'my-secret'] } }).handle(async () => {}),
        );

        const request: SecretsManagerRequest = {
          secretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(request);
        expect(result).toBeDefined();
      });
    });

    suite('secretIncludes', () => {
      test('matches when secretId contains the string', () => {
        router.route(defineRoute({ filters: { secretIncludes: ['123456789012'] } }).handle(async () => {}));

        const request: SecretsManagerRequest = {
          secretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(request);
        expect(result).toBeDefined();
      });

      test('does not match when secretId does not contain the string', () => {
        router.route(defineRoute({ filters: { secretIncludes: ['999999999999'] } }).handle(async () => {}));

        const request: SecretsManagerRequest = {
          secretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(request);
        expect(result).toBeUndefined();
      });

      test('matches when secretId contains one of multiple strings', () => {
        router.route(
          defineRoute({ filters: { secretIncludes: ['999999999999', '123456789012'] } }).handle(async () => {}),
        );

        const request: SecretsManagerRequest = {
          secretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(request);
        expect(result).toBeDefined();
      });
    });

    suite('steps', () => {
      test('matches when step is in the list', () => {
        router.route(defineRoute({ filters: { steps: ['createSecret'] } }).handle(async () => {}));

        const request: SecretsManagerRequest = {
          secretId: 'my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(request);
        expect(result).toBeDefined();
      });

      test('does not match when step is not in the list', () => {
        router.route(defineRoute({ filters: { steps: ['setSecret'] } }).handle(async () => {}));

        const request: SecretsManagerRequest = {
          secretId: 'my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(request);
        expect(result).toBeUndefined();
      });

      test('matches when step is one of multiple allowed', () => {
        router.route(defineRoute({ filters: { steps: ['createSecret', 'setSecret'] } }).handle(async () => {}));

        const request: SecretsManagerRequest = {
          secretId: 'my-secret',
          clientRequestToken: 'token',
          step: 'setSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(request);
        expect(result).toBeDefined();
      });
    });

    suite('customFilter', () => {
      test('matches when customFilter returns true', () => {
        router.route(
          defineRoute({
            filters: { customFilter: () => true },
          }).handle(async () => {}),
        );

        const request: SecretsManagerRequest = {
          secretId: 'my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(request);
        expect(result).toBeDefined();
      });

      test('does not match when customFilter returns false', () => {
        router.route(
          defineRoute({
            filters: { customFilter: () => false },
          }).handle(async () => {}),
        );

        const request: SecretsManagerRequest = {
          secretId: 'my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(request);
        expect(result).toBeUndefined();
      });

      test('receives correct input shape', () => {
        const customFilter = vi.fn().mockReturnValue(true);
        router.route(defineRoute({ filters: { customFilter } }).handle(async () => {}));

        const request: SecretsManagerRequest = {
          secretId: 'my-secret',
          clientRequestToken: 'my-token',
          step: 'testSecret',
        };
        // @ts-expect-error - testing private method directly
        router.matchRoute(request);

        expect(customFilter).toHaveBeenCalledWith({
          secretId: 'my-secret',
          clientRequestToken: 'my-token',
          step: 'testSecret',
        });
      });
    });

    suite('combined filters (AND logic)', () => {
      test('matches when both secretIds and steps match', () => {
        const secretId = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret';
        router.route(
          defineRoute({ filters: { secretIds: [secretId], steps: ['createSecret'] } }).handle(async () => {}),
        );

        const request: SecretsManagerRequest = { secretId, clientRequestToken: 'token', step: 'createSecret' };
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(request);
        expect(result).toBeDefined();
      });

      test('does not match when secretIds matches but steps does not', () => {
        const secretId = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret';
        router.route(defineRoute({ filters: { secretIds: [secretId], steps: ['setSecret'] } }).handle(async () => {}));

        const request: SecretsManagerRequest = { secretId, clientRequestToken: 'token', step: 'createSecret' };
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(request);
        expect(result).toBeUndefined();
      });

      test('does not match when steps matches but secretIds does not', () => {
        router.route(
          defineRoute({
            filters: {
              secretIds: ['arn:aws:secretsmanager:us-east-1:123456789012:secret:other'],
              steps: ['createSecret'],
            },
          }).handle(async () => {}),
        );

        const request: SecretsManagerRequest = {
          secretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(request);
        expect(result).toBeUndefined();
      });

      test('matches when prefix and customFilter both pass', () => {
        router.route(
          defineRoute({
            filters: {
              secretPrefixes: ['arn:aws:secretsmanager:us-east-1'],
              customFilter: () => true,
            },
          }).handle(async () => {}),
        );

        const request: SecretsManagerRequest = {
          secretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(request);
        expect(result).toBeDefined();
      });

      test('does not match when prefix matches but customFilter fails', () => {
        router.route(
          defineRoute({
            filters: {
              secretPrefixes: ['arn:aws:secretsmanager:us-east-1'],
              customFilter: () => false,
            },
          }).handle(async () => {}),
        );

        const request: SecretsManagerRequest = {
          secretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(request);
        expect(result).toBeUndefined();
      });
    });

    suite('edge cases', () => {
      test('empty filters act as catch-all', () => {
        router.route(defineRoute({ filters: {} }).handle(async () => {}));

        const request: SecretsManagerRequest = {
          secretId: 'any-secret',
          clientRequestToken: 'any-token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(request);
        expect(result).toBeDefined();
      });

      test('first matching route wins', () => {
        const firstHandler = vi.fn();
        const secondHandler = vi.fn();

        router.route(defineRoute({ filters: {} }).handle(firstHandler));
        router.route(defineRoute({ filters: {} }).handle(secondHandler));

        const request: SecretsManagerRequest = {
          secretId: 'any-secret',
          clientRequestToken: 'any-token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(request);
        expect(result).toBeDefined();
        // @ts-expect-error - result is asserted as defined above
        expect(result.handler).toBe(firstHandler);
      });

      test('returns undefined when no routes are defined', () => {
        const request: SecretsManagerRequest = {
          secretId: 'any-secret',
          clientRequestToken: 'any-token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(request);
        expect(result).toBeUndefined();
      });

      test('customFilter is not called when an earlier filter fails', () => {
        const customFilter = vi.fn().mockReturnValue(true);
        router.route(
          defineRoute({
            filters: {
              secretIds: ['arn:aws:secretsmanager:us-east-1:123456789012:secret:other'],
              customFilter,
            },
          }).handle(async () => {}),
        );

        const request: SecretsManagerRequest = {
          secretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        router.matchRoute(request);
        expect(customFilter).not.toHaveBeenCalled();
      });
    });
  });

  suite('handleEvent', () => {
    test('calls matched handler with the parsed request', async ({ secretsManagerHandlerEvent }) => {
      const router = createSecretsManagerRouter();
      const handler = vi.fn();
      const secretId = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret';
      router.route(defineRoute({ filters: { secretIds: [secretId] } }).handle(handler));

      const { event, context } = secretsManagerHandlerEvent({
        event: { SecretId: secretId, Step: 'createSecret', ClientRequestToken: 'my-token' },
      });
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith({
        secretId,
        clientRequestToken: 'my-token',
        step: 'createSecret',
      });
    });

    test('returns undefined on success', async ({ secretsManagerHandlerEvent }) => {
      const router = createSecretsManagerRouter();
      router.route(defineRoute({ filters: {} }).handle(async () => {}));

      const { event, context } = secretsManagerHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toBeUndefined();
    });

    test('throws when no route matches', async ({ secretsManagerHandlerEvent }) => {
      const router = createSecretsManagerRouter();

      const { event, context } = secretsManagerHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow(
        `No route matched for Secrets Manager rotation event (step: ${event.Step}, secretId: ${event.SecretId})`,
      );
    });

    test('propagates handler errors', async ({ secretsManagerHandlerEvent }) => {
      const router = createSecretsManagerRouter();
      router.route(
        defineRoute({ filters: {} }).handle(async () => {
          throw new Error('handler exploded');
        }),
      );

      const { event, context } = secretsManagerHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('handler exploded');
    });
  });

  suite('full event processing', () => {
    test('routes to different handlers based on step filters', async ({ secretsManagerHandlerEvent }) => {
      const createHandler = vi.fn();
      const setHandler = vi.fn();
      const router = createSecretsManagerRouter();

      router.route(defineRoute({ filters: { steps: ['createSecret'] } }).handle(createHandler));
      router.route(defineRoute({ filters: { steps: ['setSecret'] } }).handle(setHandler));

      const { context } = secretsManagerHandlerEvent();
      const createEvent = createSecretsManagerRotationEvent({ Step: 'createSecret' });
      const setEvent = createSecretsManagerRotationEvent({ Step: 'setSecret' });

      await router.handleEvent(createEvent, context);
      await router.handleEvent(setEvent, context);

      expect(createHandler).toHaveBeenCalledTimes(1);
      expect(setHandler).toHaveBeenCalledTimes(1);
    });

    test('routes to different handlers based on secretIds', async ({ secretsManagerHandlerEvent }) => {
      const secretAHandler = vi.fn();
      const secretBHandler = vi.fn();
      const secretA = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:secret-a';
      const secretB = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:secret-b';
      const router = createSecretsManagerRouter();

      router.route(defineRoute({ filters: { secretIds: [secretA] } }).handle(secretAHandler));
      router.route(defineRoute({ filters: { secretIds: [secretB] } }).handle(secretBHandler));

      const { context } = secretsManagerHandlerEvent();
      const eventA = createSecretsManagerRotationEvent({ SecretId: secretA });
      const eventB = createSecretsManagerRotationEvent({ SecretId: secretB });

      await router.handleEvent(eventA, context);
      await router.handleEvent(eventB, context);

      expect(secretAHandler).toHaveBeenCalledTimes(1);
      expect(secretBHandler).toHaveBeenCalledTimes(1);
    });

    test('catch-all route handles unmatched events', async ({ secretsManagerHandlerEvent }) => {
      const specificHandler = vi.fn();
      const catchAllHandler = vi.fn();
      const router = createSecretsManagerRouter();

      router.route(defineRoute({ filters: { steps: ['createSecret'] } }).handle(specificHandler));
      router.route(defineRoute({ filters: {} }).handle(catchAllHandler));

      const { context } = secretsManagerHandlerEvent();
      const event = createSecretsManagerRotationEvent({ Step: 'setSecret' });
      await router.handleEvent(event, context);

      expect(specificHandler).not.toHaveBeenCalled();
      expect(catchAllHandler).toHaveBeenCalledTimes(1);
    });

    test('step convenience methods with other filters work together', async ({ secretsManagerHandlerEvent }) => {
      const handler = vi.fn();
      const secretId = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret';
      const router = createSecretsManagerRouter();

      router.createSecret({ filters: { secretIds: [secretId] }, handler });

      const { context } = secretsManagerHandlerEvent();
      const matchingEvent = createSecretsManagerRotationEvent({ SecretId: secretId, Step: 'createSecret' });
      await router.handleEvent(matchingEvent, context);

      expect(handler).toHaveBeenCalledTimes(1);

      const nonMatchingEvent = createSecretsManagerRotationEvent({ SecretId: secretId, Step: 'setSecret' });
      await expect(router.handleEvent(nonMatchingEvent, context)).rejects.toThrow('No route matched');
    });
  });
});
