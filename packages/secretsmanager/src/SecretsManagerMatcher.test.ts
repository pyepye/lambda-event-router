import { allEventBuilders, createSecretsManagerRotationEvent, test } from '@latcher/testing';

import { createSecretsManagerMatcher, defineRoute, SecretsManagerMatcher } from './SecretsManagerMatcher.js';
import type { SecretsManagerFilterInput, SecretsManagerFilters, SecretsManagerRequest } from './types.js';

type SecretsManagerNext = (request: SecretsManagerRequest) => Promise<void>;

suite('SecretsManagerMatcher', () => {
  let matcher: SecretsManagerMatcher;

  beforeEach(() => {
    matcher = new SecretsManagerMatcher();
  });

  suite('createSecretsManagerMatcher', () => {
    test('creates a SecretsManagerMatcher instance', () => {
      const matcher = createSecretsManagerMatcher();
      expect(matcher).toBeInstanceOf(SecretsManagerMatcher);
    });
  });

  suite('canHandleEvent', () => {
    test.each([
      'createSecret',
      'setSecret',
      'testSecret',
      'finishSecret',
    ] as const)('returns true for %s step', (step) => {
      const event = createSecretsManagerRotationEvent({ Step: step });
      expect(matcher.canHandleEvent(event)).toBe(true);
    });

    test('returns false for null', () => {
      expect(matcher.canHandleEvent(null)).toBe(false);
    });

    test('returns false for a string', () => {
      expect(matcher.canHandleEvent('not an event')).toBe(false);
    });

    test('returns false for an array', () => {
      expect(matcher.canHandleEvent([1, 2, 3])).toBe(false);
    });

    test('returns false for a non-object', () => {
      expect(matcher.canHandleEvent(42)).toBe(false);
    });

    test('returns false when SecretId is missing', () => {
      expect(matcher.canHandleEvent({ ClientRequestToken: 'token', Step: 'createSecret' })).toBe(false);
    });

    test('returns false when SecretId is not a string', () => {
      expect(matcher.canHandleEvent({ SecretId: 123, ClientRequestToken: 'token', Step: 'createSecret' })).toBe(false);
    });

    test('returns false when ClientRequestToken is missing', () => {
      expect(matcher.canHandleEvent({ SecretId: 'secret-id', Step: 'createSecret' })).toBe(false);
    });

    test('returns false when ClientRequestToken is not a string', () => {
      expect(matcher.canHandleEvent({ SecretId: 'secret-id', ClientRequestToken: 123, Step: 'createSecret' })).toBe(
        false,
      );
    });

    test('returns false when Step is missing', () => {
      expect(matcher.canHandleEvent({ SecretId: 'secret-id', ClientRequestToken: 'token' })).toBe(false);
    });

    test('returns false when Step is not a string', () => {
      expect(matcher.canHandleEvent({ SecretId: 'secret-id', ClientRequestToken: 'token', Step: 123 })).toBe(false);
    });

    test('returns false when Step is an invalid string value', () => {
      expect(matcher.canHandleEvent({ SecretId: 'secret-id', ClientRequestToken: 'token', Step: 'invalidStep' })).toBe(
        false,
      );
    });
  });

  suite('defineRoute', () => {
    test('returns a route builder with a handle method', () => {
      const builder = defineRoute({
        filters: { secretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret-abc123' },
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });

    test('preserves filters and handler in the definition', () => {
      const handler = vi.fn();
      const filters: SecretsManagerFilters = {
        secretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret-abc123',
        step: 'createSecret',
      };

      const definition = defineRoute({ filters }).handle(handler);

      expect(definition).toEqual({ filters, middleware: [], handler });
    });
  });

  suite('route', () => {
    test('returns the matcher instance for chaining', () => {
      const definition = defineRoute({
        filters: { secretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret-abc123' },
      }).handle(async () => {});

      const result = matcher.route(definition);

      expect(result).toBe(matcher);
    });
  });

  suite('step convenience methods', () => {
    test.each([
      'createSecret',
      'setSecret',
      'testSecret',
      'finishSecret',
    ] as const)('%s adds route with correct step filter', async (step) => {
      const handler = vi.fn();

      matcher[step]({ filters: {}, handler });

      const request: SecretsManagerFilterInput = {
        secretId: 'my-secret',
        secretName: 'my-secret',
        clientRequestToken: 'token',
        step,
      };
      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute(request);
      expect(matched).toBeDefined();
    });

    test('preserves other filters alongside injected steps', async () => {
      const handler = vi.fn();
      const secretId = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret-abc123';

      matcher.createSecret({ filters: { secretId: secretId }, handler });

      const matchingRequest: SecretsManagerFilterInput = {
        secretId,
        secretName: 'my-secret',
        clientRequestToken: 'token',
        step: 'createSecret',
      };
      // @ts-expect-error - testing private method directly
      const matched = await matcher.matchRoute(matchingRequest);
      expect(matched).toBeDefined();

      const nonMatchingRequest: SecretsManagerFilterInput = {
        secretId: 'other-secret',
        secretName: 'other-secret',
        clientRequestToken: 'token',
        step: 'createSecret',
      };
      // @ts-expect-error - testing private method directly
      const notMatched = await matcher.matchRoute(nonMatchingRequest);
      expect(notMatched).toBeUndefined();
    });

    test('returns this for chaining', () => {
      const handler = vi.fn();

      const result = matcher.createSecret({ filters: {}, handler });

      expect(result).toBe(matcher);
    });
  });

  suite('matchRoute', () => {
    suite('secretIds', () => {
      test('matches on secretId', async () => {
        const secretId = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret-abc123';
        matcher.route(defineRoute({ filters: { secretId: secretId } }).handle(async () => {}));

        const request: SecretsManagerFilterInput = {
          secretId,
          secretName: 'my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = await matcher.matchRoute(request);
        expect(result).toBeDefined();
      });

      test('does not match when secretId is an empty string', async () => {
        const secretId = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret-abc123';
        matcher.route(defineRoute({ filters: { secretId: '' } }).handle(async () => {}));

        const request: SecretsManagerFilterInput = {
          secretId,
          secretName: 'my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = await matcher.matchRoute(request);
        expect(result).toBeUndefined();
      });

      test('does not match when secretId', async () => {
        matcher.route(
          defineRoute({
            filters: { secretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:other-def456' },
          }).handle(async () => {}),
        );

        const request: SecretsManagerFilterInput = {
          secretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret-abc123',
          secretName: 'my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = await matcher.matchRoute(request);
        expect(result).toBeUndefined();
      });

      test('matches when secretId is one of multiple allowed', async () => {
        const secretIdA = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:secret-a-abc123';
        const secretIdB = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:secret-b-def456';
        matcher.route(defineRoute({ filters: { secretId: [secretIdA, secretIdB] } }).handle(async () => {}));

        const request: SecretsManagerFilterInput = {
          secretId: secretIdB,
          secretName: 'secret-b',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = await matcher.matchRoute(request);
        expect(result).toBeDefined();
      });

      test('matches when secretId contains the string', async () => {
        matcher.route(defineRoute({ filters: { secretId: '*123456789012*' } }).handle(async () => {}));

        const request: SecretsManagerFilterInput = {
          secretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret-abc123',
          secretName: 'my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = await matcher.matchRoute(request);
        expect(result).toBeDefined();
      });

      test('does not match when secretId does not contain the string', async () => {
        matcher.route(defineRoute({ filters: { secretId: '*999999999999*' } }).handle(async () => {}));

        const request: SecretsManagerFilterInput = {
          secretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret-abc123',
          secretName: 'my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = await matcher.matchRoute(request);
        expect(result).toBeUndefined();
      });

      test('matches when secretId wildcard contains one of multiple strings', async () => {
        matcher.route(
          defineRoute({ filters: { secretId: ['*999999999999*', '*123456789012*'] } }).handle(async () => {}),
        );

        const request: SecretsManagerFilterInput = {
          secretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret-abc123',
          secretName: 'my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = await matcher.matchRoute(request);
        expect(result).toBeDefined();
      });

      test('matches when the filter is the secret name and the event carries the arn', async () => {
        matcher.route(defineRoute({ filters: { secretId: 'my-secret' } }).handle(async () => {}));

        const request: SecretsManagerFilterInput = {
          secretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret-abc123',
          secretName: 'my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = await matcher.matchRoute(request);
        expect(result).toBeDefined();
      });

      test('matches a wildcard that only fits the name', async () => {
        matcher.route(defineRoute({ filters: { secretId: '*-secret' } }).handle(async () => {}));

        const request: SecretsManagerFilterInput = {
          secretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret-abc123',
          secretName: 'my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = await matcher.matchRoute(request);
        expect(result).toBeDefined();
      });

      test('matches a regex that only fits the name', async () => {
        matcher.route(defineRoute({ filters: { secretId: /^my-secret$/ } }).handle(async () => {}));

        const request: SecretsManagerFilterInput = {
          secretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret-abc123',
          secretName: 'my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = await matcher.matchRoute(request);
        expect(result).toBeDefined();
      });

      test('does not match when neither the arn nor the name fits', async () => {
        matcher.route(defineRoute({ filters: { secretId: 'other-secret' } }).handle(async () => {}));

        const request: SecretsManagerFilterInput = {
          secretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret-abc123',
          secretName: 'my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = await matcher.matchRoute(request);
        expect(result).toBeUndefined();
      });
    });

    suite('steps', () => {
      test('matches when step', async () => {
        matcher.route(defineRoute({ filters: { step: 'createSecret' } }).handle(async () => {}));

        const request: SecretsManagerFilterInput = {
          secretId: 'my-secret',
          secretName: 'my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = await matcher.matchRoute(request);
        expect(result).toBeDefined();
      });

      test('does not match when step', async () => {
        matcher.route(defineRoute({ filters: { step: 'setSecret' } }).handle(async () => {}));

        const request: SecretsManagerFilterInput = {
          secretId: 'my-secret',
          secretName: 'my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = await matcher.matchRoute(request);
        expect(result).toBeUndefined();
      });

      test('matches when step is one of multiple allowed', async () => {
        matcher.route(defineRoute({ filters: { step: ['createSecret', 'setSecret'] } }).handle(async () => {}));

        const request: SecretsManagerFilterInput = {
          secretId: 'my-secret',
          secretName: 'my-secret',
          clientRequestToken: 'token',
          step: 'setSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = await matcher.matchRoute(request);
        expect(result).toBeDefined();
      });
    });

    suite('custom', () => {
      test('matches when custom returns true', async () => {
        matcher.route(
          defineRoute({
            filters: { custom: () => true },
          }).handle(async () => {}),
        );

        const request: SecretsManagerFilterInput = {
          secretId: 'my-secret',
          secretName: 'my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = await matcher.matchRoute(request);
        expect(result).toBeDefined();
      });

      test('does not match when custom returns false', async () => {
        matcher.route(
          defineRoute({
            filters: { custom: () => false },
          }).handle(async () => {}),
        );

        const request: SecretsManagerFilterInput = {
          secretId: 'my-secret',
          secretName: 'my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = await matcher.matchRoute(request);
        expect(result).toBeUndefined();
      });

      test('receives correct input shape', async () => {
        const custom = vi.fn().mockReturnValue(true);
        matcher.route(defineRoute({ filters: { custom } }).handle(async () => {}));

        const request: SecretsManagerFilterInput = {
          secretId: 'my-secret',
          secretName: 'my-secret',
          clientRequestToken: 'my-token',
          step: 'testSecret',
        };
        // @ts-expect-error - testing private method directly
        await matcher.matchRoute(request);

        expect(custom).toHaveBeenCalledWith({
          secretId: 'my-secret',
          secretName: 'my-secret',
          clientRequestToken: 'my-token',
          step: 'testSecret',
        });
      });

      test('matches route by async custom', async () => {
        const asyncFilter = vi.fn().mockResolvedValue(true);
        matcher.route(
          defineRoute({
            filters: { custom: asyncFilter },
          }).handle(async () => {}),
        );

        const request: SecretsManagerFilterInput = {
          secretId: 'my-secret',
          secretName: 'my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = await matcher.matchRoute(request);
        expect(result).toBeDefined();
        expect(asyncFilter).toHaveBeenCalledWith(request);
      });
    });

    suite('combined filters (AND logic)', () => {
      test('matches when both secretIds and steps match', async () => {
        const secretId = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret-abc123';
        matcher.route(defineRoute({ filters: { secretId: secretId, step: 'createSecret' } }).handle(async () => {}));

        const request: SecretsManagerFilterInput = {
          secretId,
          secretName: 'my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = await matcher.matchRoute(request);
        expect(result).toBeDefined();
      });

      test('does not match when secretIds matches but steps does not', async () => {
        const secretId = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret-abc123';
        matcher.route(defineRoute({ filters: { secretId: secretId, step: 'setSecret' } }).handle(async () => {}));

        const request: SecretsManagerFilterInput = {
          secretId,
          secretName: 'my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = await matcher.matchRoute(request);
        expect(result).toBeUndefined();
      });

      test('does not match when steps matches but secretIds does not', async () => {
        matcher.route(
          defineRoute({
            filters: {
              secretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:other-def456',
              step: 'createSecret',
            },
          }).handle(async () => {}),
        );

        const request: SecretsManagerFilterInput = {
          secretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret-abc123',
          secretName: 'my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = await matcher.matchRoute(request);
        expect(result).toBeUndefined();
      });

      test('matches when secredId and custom both pass', async () => {
        matcher.route(
          defineRoute({
            filters: {
              secretId: 'arn:aws:secretsmanager:us-east-1*',
              custom: () => true,
            },
          }).handle(async () => {}),
        );

        const request: SecretsManagerFilterInput = {
          secretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret-abc123',
          secretName: 'my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = await matcher.matchRoute(request);
        expect(result).toBeDefined();
      });

      test('does not match when secretId matches but custom fails', async () => {
        matcher.route(
          defineRoute({
            filters: {
              secretId: 'arn:aws:secretsmanager:us-east-1*',
              custom: () => false,
            },
          }).handle(async () => {}),
        );

        const request: SecretsManagerFilterInput = {
          secretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret-abc123',
          secretName: 'my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = await matcher.matchRoute(request);
        expect(result).toBeUndefined();
      });
    });

    suite('edge saSecretsManager', () => {
      test('empty filters act as catch-all', async () => {
        matcher.route(defineRoute({ filters: {} }).handle(async () => {}));

        const request: SecretsManagerFilterInput = {
          secretId: 'any-secret',
          secretName: 'any-secret',
          clientRequestToken: 'any-token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = await matcher.matchRoute(request);
        expect(result).toBeDefined();
      });

      test('first matching route wins', async () => {
        const firstHandler = vi.fn();
        const secondHandler = vi.fn();

        matcher.route(defineRoute({ filters: {} }).handle(firstHandler));
        matcher.route(defineRoute({ filters: {} }).handle(secondHandler));

        const request: SecretsManagerFilterInput = {
          secretId: 'any-secret',
          secretName: 'any-secret',
          clientRequestToken: 'any-token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = await matcher.matchRoute(request);
        expect(result).toBeDefined();
        // @ts-expect-error - result is asserted as defined above
        expect(result.handler).toBe(firstHandler);
      });

      test('orders a narrower route ahead of a broader one registered first', async () => {
        const broad = vi.fn();
        const narrow = vi.fn();

        matcher.route(defineRoute({ filters: {} }).handle(broad));
        matcher.route(defineRoute({ filters: { step: 'createSecret' } }).handle(narrow));

        const request: SecretsManagerFilterInput = {
          secretId: 'any-secret',
          secretName: 'any-secret',
          clientRequestToken: 'any-token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = await matcher.matchRoute(request);

        expect(result?.handler).toBe(narrow);
      });

      test('orders a guarded route ahead of the fallback it shares filters with', async () => {
        const fallback = vi.fn();
        const guarded = vi.fn();

        matcher.route(defineRoute({ filters: { step: 'createSecret' } }).handle(fallback));
        matcher.route(defineRoute({ filters: { step: 'createSecret', custom: () => true } }).handle(guarded));

        const request: SecretsManagerFilterInput = {
          secretId: 'any-secret',
          secretName: 'any-secret',
          clientRequestToken: 'any-token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = await matcher.matchRoute(request);

        expect(result?.handler).toBe(guarded);
      });

      test('returns undefined when no routes are defined', async () => {
        const request: SecretsManagerFilterInput = {
          secretId: 'any-secret',
          secretName: 'any-secret',
          clientRequestToken: 'any-token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        const result = await matcher.matchRoute(request);
        expect(result).toBeUndefined();
      });

      test('custom is not called when an earlier filter fails', async () => {
        const custom = vi.fn().mockReturnValue(true);
        matcher.route(
          defineRoute({
            filters: {
              secretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:other-def456',
              custom,
            },
          }).handle(async () => {}),
        );

        const request: SecretsManagerFilterInput = {
          secretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret-abc123',
          secretName: 'my-secret',
          clientRequestToken: 'token',
          step: 'createSecret',
        };
        // @ts-expect-error - testing private method directly
        await matcher.matchRoute(request);
        expect(custom).not.toHaveBeenCalled();
      });
    });
  });

  suite('handleEvent', () => {
    test('calls matched handler with the parsed request', async ({ secretsManagerHandlerEvent }) => {
      const handler = vi.fn();
      const secretId = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret-abc123';
      matcher.route(defineRoute({ filters: { secretId: secretId } }).handle(handler));

      const { event, context } = secretsManagerHandlerEvent({
        event: { SecretId: secretId, Step: 'createSecret', ClientRequestToken: 'my-token' },
      });
      await matcher.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith({
        secretId,
        secretName: 'my-secret',
        clientRequestToken: 'my-token',
        rotationToken: event.RotationToken,
        step: 'createSecret',
        event,
        context,
      });
    });

    test('derives the secret name from the arn', async ({ secretsManagerHandlerEvent }) => {
      const handler = vi.fn();
      matcher.route(defineRoute({ filters: {} }).handle(handler));

      const { event, context } = secretsManagerHandlerEvent({
        event: { SecretId: 'arn:aws:secretsmanager:eu-west-2:123456789012:secret:prod/orders/api-token-TiYun4' },
      });
      await matcher.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ secretName: 'prod/orders/api-token' }));
    });

    test('uses the secret id as the name when it is not an arn', async ({ secretsManagerHandlerEvent }) => {
      const handler = vi.fn();
      matcher.route(defineRoute({ filters: {} }).handle(handler));

      const { event, context } = secretsManagerHandlerEvent({ event: { SecretId: 'my-secret' } });
      await matcher.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ secretName: 'my-secret' }));
    });

    test('passes the rotation token through', async ({ secretsManagerHandlerEvent }) => {
      const handler = vi.fn();
      matcher.route(defineRoute({ filters: {} }).handle(handler));

      const { event, context } = secretsManagerHandlerEvent({ event: { RotationToken: 'rotation-token' } });
      await matcher.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ rotationToken: 'rotation-token' }));
    });

    test('leaves the rotation token undefined when the event has none', async ({ secretsManagerHandlerEvent }) => {
      const handler = vi.fn();
      matcher.route(defineRoute({ filters: {} }).handle(handler));

      const { event, context } = secretsManagerHandlerEvent();
      delete event.RotationToken;
      await matcher.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ rotationToken: undefined }));
    });

    test('returns undefined on success', async ({ secretsManagerHandlerEvent }) => {
      matcher.route(defineRoute({ filters: {} }).handle(async () => {}));

      const { event, context } = secretsManagerHandlerEvent();
      const result = await matcher.handleEvent(event, context);

      expect(result).toBeUndefined();
    });

    test('throws when no route matches', async ({ secretsManagerHandlerEvent }) => {
      const { event, context } = secretsManagerHandlerEvent();
      await expect(matcher.handleEvent(event, context)).rejects.toThrow(
        `No route matched for Secrets Manager rotation event (step: ${event.Step}, secretId: ${event.SecretId})`,
      );
    });

    test('propagates handler errors', async ({ secretsManagerHandlerEvent }) => {
      matcher.route(
        defineRoute({ filters: {} }).handle(async () => {
          throw new Error('handler exploded');
        }),
      );

      const { event, context } = secretsManagerHandlerEvent();
      await expect(matcher.handleEvent(event, context)).rejects.toThrow('handler exploded');
    });
  });

  suite('full event processing', () => {
    test('routes to different handlers based on step filters', async ({ secretsManagerHandlerEvent }) => {
      const createHandler = vi.fn();
      const setHandler = vi.fn();

      matcher.route(defineRoute({ filters: { step: 'createSecret' } }).handle(createHandler));
      matcher.route(defineRoute({ filters: { step: 'setSecret' } }).handle(setHandler));

      const { context } = secretsManagerHandlerEvent();
      const createEvent = createSecretsManagerRotationEvent({ Step: 'createSecret' });
      const setEvent = createSecretsManagerRotationEvent({ Step: 'setSecret' });

      await matcher.handleEvent(createEvent, context);
      await matcher.handleEvent(setEvent, context);

      expect(createHandler).toHaveBeenCalledTimes(1);
      expect(setHandler).toHaveBeenCalledTimes(1);
    });

    test('routes to different handlers based on secretIds', async ({ secretsManagerHandlerEvent }) => {
      const secretAHandler = vi.fn();
      const secretBHandler = vi.fn();
      const secretA = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:secret-a-abc123';
      const secretB = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:secret-b-def456';

      matcher.route(defineRoute({ filters: { secretId: secretA } }).handle(secretAHandler));
      matcher.route(defineRoute({ filters: { secretId: secretB } }).handle(secretBHandler));

      const { context } = secretsManagerHandlerEvent();
      const eventA = createSecretsManagerRotationEvent({ SecretId: secretA });
      const eventB = createSecretsManagerRotationEvent({ SecretId: secretB });

      await matcher.handleEvent(eventA, context);
      await matcher.handleEvent(eventB, context);

      expect(secretAHandler).toHaveBeenCalledTimes(1);
      expect(secretBHandler).toHaveBeenCalledTimes(1);
    });

    test('catch-all route handles unmatched events', async ({ secretsManagerHandlerEvent }) => {
      const specificHandler = vi.fn();
      const catchAllHandler = vi.fn();

      matcher.route(defineRoute({ filters: { step: 'createSecret' } }).handle(specificHandler));
      matcher.route(defineRoute({ filters: {} }).handle(catchAllHandler));

      const { context } = secretsManagerHandlerEvent();
      const event = createSecretsManagerRotationEvent({ Step: 'setSecret' });
      await matcher.handleEvent(event, context);

      expect(specificHandler).not.toHaveBeenCalled();
      expect(catchAllHandler).toHaveBeenCalledTimes(1);
    });

    test('step convenience methods with other filters work together', async ({ secretsManagerHandlerEvent }) => {
      const handler = vi.fn();
      const secretId = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret-abc123';

      matcher.createSecret({ filters: { secretId: secretId }, handler });

      const { context } = secretsManagerHandlerEvent();
      const matchingEvent = createSecretsManagerRotationEvent({ SecretId: secretId, Step: 'createSecret' });
      await matcher.handleEvent(matchingEvent, context);

      expect(handler).toHaveBeenCalledTimes(1);

      const nonMatchingEvent = createSecretsManagerRotationEvent({ SecretId: secretId, Step: 'setSecret' });
      await expect(matcher.handleEvent(nonMatchingEvent, context)).rejects.toThrow('No route matched');
    });
  });

  suite('matcher-level middleware', () => {
    test('executes middleware before the route handler', async ({ secretsManagerHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middleware(request: SecretsManagerRequest, next: SecretsManagerNext): Promise<void> {
        callOrder.push('mw-pre');
        await next(request);
        callOrder.push('mw-post');
      }

      const matcher = createSecretsManagerMatcher({ middleware: [middleware] });
      matcher.route({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = secretsManagerHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
    });

    test('allows middleware to skip a record by not calling next', async ({ secretsManagerHandlerEvent }) => {
      const handler = vi.fn();

      async function skipMiddleware(_request: SecretsManagerRequest, _next: SecretsManagerNext): Promise<void> {
        return;
      }

      const matcher = createSecretsManagerMatcher({ middleware: [skipMiddleware] });
      matcher.route({ filters: {}, handler });

      const { event, context } = secretsManagerHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple matcher-level middleware in order', async ({ secretsManagerHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middlewareOne(request: SecretsManagerRequest, next: SecretsManagerNext): Promise<void> {
        callOrder.push('mw1');
        await next(request);
      }

      async function middlewareTwo(request: SecretsManagerRequest, next: SecretsManagerNext): Promise<void> {
        callOrder.push('mw2');
        await next(request);
      }

      const matcher = createSecretsManagerMatcher({ middleware: [middlewareOne, middlewareTwo] });
      matcher.route({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = secretsManagerHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['mw1', 'mw2', 'handler']);
    });
  });

  suite('route-level middleware', () => {
    test('executes route-level middleware for a specific route', async ({ secretsManagerHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: SecretsManagerRequest, next: SecretsManagerNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      matcher.route({
        filters: {},
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = secretsManagerHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });

    test('allows route-level middleware to short-circuit by not calling next', async ({
      secretsManagerHandlerEvent,
    }) => {
      const handler = vi.fn();

      async function blockingRouteMiddleware(
        _request: SecretsManagerRequest,
        _next: SecretsManagerNext,
      ): Promise<void> {
        return;
      }

      matcher.route({ filters: {}, middleware: [blockingRouteMiddleware], handler });

      const { event, context } = secretsManagerHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple route-level middleware in order', async ({ secretsManagerHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddlewareOne(request: SecretsManagerRequest, next: SecretsManagerNext): Promise<void> {
        callOrder.push('route-mw1');
        await next(request);
      }

      async function routeMiddlewareTwo(request: SecretsManagerRequest, next: SecretsManagerNext): Promise<void> {
        callOrder.push('route-mw2');
        await next(request);
      }

      matcher.route({
        filters: {},
        middleware: [routeMiddlewareOne, routeMiddlewareTwo],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = secretsManagerHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw1', 'route-mw2', 'handler']);
    });

    test('supports middleware on defineRoute builder pattern', async ({ secretsManagerHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: SecretsManagerRequest, next: SecretsManagerNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      const route = defineRoute({ filters: {}, middleware: [routeMiddleware] }).handle(async () => {
        callOrder.push('handler');
      });

      matcher.route(route);

      const { event, context } = secretsManagerHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });
  });

  suite('combined matcher and route middleware', () => {
    test('executes matcher middleware before route middleware', async ({ secretsManagerHandlerEvent }) => {
      const callOrder: string[] = [];

      async function matcherMiddleware(request: SecretsManagerRequest, next: SecretsManagerNext): Promise<void> {
        callOrder.push('matcher-mw');
        await next(request);
      }

      async function routeMiddleware(request: SecretsManagerRequest, next: SecretsManagerNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      const matcher = createSecretsManagerMatcher({ middleware: [matcherMiddleware] });
      matcher.route({
        filters: {},
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = secretsManagerHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['matcher-mw', 'route-mw', 'handler']);
    });

    test('matcher middleware short-circuit prevents route middleware from running', async ({
      secretsManagerHandlerEvent,
    }) => {
      const routeMiddleware = vi.fn();
      const handler = vi.fn();

      async function blockingMatcherMiddleware(
        _request: SecretsManagerRequest,
        _next: SecretsManagerNext,
      ): Promise<void> {
        return;
      }

      const matcher = createSecretsManagerMatcher({ middleware: [blockingMatcherMiddleware] });
      matcher.route({ filters: {}, middleware: [routeMiddleware], handler });

      const { event, context } = secretsManagerHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(routeMiddleware).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });
  });
});

suite('SecretsManagerMatcher.canHandleEvent', () => {
  const ownEvents = ['createSecretsManagerRotationEvent'];

  test.each(allEventBuilders())('%s', async (name, build) => {
    const event = build();
    const isOwnEvent = ownEvents.includes(name);

    const claimed = await createSecretsManagerMatcher().canHandleEvent(event);

    expect(claimed).toBe(isOwnEvent);
  });
});
