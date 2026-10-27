import { allEventBuilders, createCodeCommitEvent, test } from '@latcher/testing';

import { CodeCommitMatcher, createCodeCommitMatcher, defineRoute } from './CodeCommitMatcher.js';
import type { CodeCommitFilterInput, CodeCommitRequest } from './types.js';

type CodeCommitNext = (request: CodeCommitRequest) => Promise<void>;

suite('CodeCommitMatcher', () => {
  let matcher: CodeCommitMatcher;

  beforeEach(() => {
    matcher = new CodeCommitMatcher();
  });

  suite('createCodeCommitMatcher', () => {
    test('creates a CodeCommitMatcher instance', () => {
      const matcher = createCodeCommitMatcher();
      expect(matcher).toBeInstanceOf(CodeCommitMatcher);
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for a valid CodeCommit event', () => {
      const event = createCodeCommitEvent();
      expect(matcher.canHandleEvent(event)).toBe(true);
    });

    test('returns false for a non-CodeCommit event', () => {
      const event = { detail: { foo: 'bar' }, source: 'custom.app' };
      expect(matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false for null', () => {
      expect(matcher.canHandleEvent(null)).toBe(false);
    });

    test('returns false for a string', () => {
      expect(matcher.canHandleEvent('not an event')).toBe(false);
    });

    test('returns false when Records is not an array', () => {
      expect(matcher.canHandleEvent({ Records: 'not-an-array' })).toBe(false);
    });

    test('returns false when first record is not an object', () => {
      expect(matcher.canHandleEvent({ Records: ['not-an-object'] })).toBe(false);
    });

    test('returns false when eventSource is not aws:codecommit', () => {
      expect(matcher.canHandleEvent({ Records: [{ eventSource: 'aws:sqs' }] })).toBe(false);
    });
  });

  suite('defineRoute', () => {
    test('returns a route builder with a handle method', () => {
      const builder = defineRoute({
        filters: { eventSourceArn: 'arn:aws:codecommit:us-east-1:123456789012:my-repo' },
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });

    test('preserves filters and handler in the definition', () => {
      const handler = vi.fn();
      const filters = {
        eventSourceArn: 'arn:aws:codecommit:us-east-1:123456789012:my-repo',
        branch: 'main',
      };

      const definition = defineRoute({ filters }).handle(handler);

      expect(definition).toEqual({ filters, handler });
    });
  });

  suite('route', () => {
    test('returns the matcher instance for chaining', () => {
      const definition = defineRoute({
        filters: {},
      }).handle(async () => {});

      const result = matcher.route(definition);

      expect(result).toBe(matcher);
    });
  });

  suite('push', () => {
    test('returns the matcher instance for chaining', () => {
      const definition = defineRoute({
        filters: {},
      }).handle(async () => {});

      const result = matcher.push(definition);

      expect(result).toBe(matcher);
    });

    test('only matches push references', async ({ codeCommitRecord, codeCommitReference }) => {
      matcher.push(defineRoute({ filters: {} }).handle(async () => {}));

      const pushRef = codeCommitReference({ ref: 'refs/heads/main' });
      const createdRef = codeCommitReference({ ref: 'refs/heads/feature', created: true });
      const deletedRef = codeCommitReference({ ref: 'refs/heads/old-branch', deleted: true });
      const record = codeCommitRecord({
        codecommit: { references: [pushRef, createdRef, deletedRef] },
      });
      // @ts-expect-error - testing private method directly
      const route = matcher.routes[0];
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(route, record);

      expect(result).toBeDefined();
      expect(result?.references).toEqual([pushRef]);
    });
  });

  suite('branchCreated', () => {
    test('returns the matcher instance for chaining', () => {
      const definition = defineRoute({
        filters: {},
      }).handle(async () => {});

      const result = matcher.branchCreated(definition);

      expect(result).toBe(matcher);
    });

    test('only matches created references', async ({ codeCommitRecord, codeCommitReference }) => {
      matcher.branchCreated(defineRoute({ filters: {} }).handle(async () => {}));

      const pushRef = codeCommitReference({ ref: 'refs/heads/main' });
      const createdRef = codeCommitReference({ ref: 'refs/heads/feature', created: true });
      const deletedRef = codeCommitReference({ ref: 'refs/heads/old-branch', deleted: true });
      const record = codeCommitRecord({
        codecommit: { references: [pushRef, createdRef, deletedRef] },
      });
      // @ts-expect-error - testing private method directly
      const route = matcher.routes[0];
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(route, record);

      expect(result).toBeDefined();
      expect(result?.references).toEqual([createdRef]);
    });
  });

  suite('branchDeleted', () => {
    test('returns the matcher instance for chaining', () => {
      const definition = defineRoute({
        filters: {},
      }).handle(async () => {});

      const result = matcher.branchDeleted(definition);

      expect(result).toBe(matcher);
    });

    test('only matches deleted references', async ({ codeCommitRecord, codeCommitReference }) => {
      matcher.branchDeleted(defineRoute({ filters: {} }).handle(async () => {}));

      const pushRef = codeCommitReference({ ref: 'refs/heads/main' });
      const createdRef = codeCommitReference({ ref: 'refs/heads/feature', created: true });
      const deletedRef = codeCommitReference({ ref: 'refs/heads/old-branch', deleted: true });
      const record = codeCommitRecord({
        codecommit: { references: [pushRef, createdRef, deletedRef] },
      });
      // @ts-expect-error - testing private method directly
      const route = matcher.routes[0];
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(route, record);

      expect(result).toBeDefined();
      expect(result?.references).toEqual([deletedRef]);
    });
  });

  suite('filterReferences', () => {
    test('push filter returns references without created or deleted', ({ codeCommitReference }) => {
      const pushRef = codeCommitReference();
      const createdRef = codeCommitReference({ created: true });
      const deletedRef = codeCommitReference({ deleted: true });

      // @ts-expect-error - testing private method directly
      const result = matcher.filterReferences([pushRef, createdRef, deletedRef], 'push');

      expect(result).toEqual([pushRef]);
    });

    test('push filter excludes references with created set to true', ({ codeCommitReference }) => {
      const createdRef = codeCommitReference({ created: true });

      // @ts-expect-error - testing private method directly
      const result = matcher.filterReferences([createdRef], 'push');

      expect(result).toHaveLength(0);
    });

    test('push filter excludes references with deleted set to true', ({ codeCommitReference }) => {
      const deletedRef = codeCommitReference({ deleted: true });

      // @ts-expect-error - testing private method directly
      const result = matcher.filterReferences([deletedRef], 'push');

      expect(result).toHaveLength(0);
    });

    test('branchCreated filter returns only references with created true', ({ codeCommitReference }) => {
      const pushRef = codeCommitReference();
      const createdRef = codeCommitReference({ created: true });

      // @ts-expect-error - testing private method directly
      const result = matcher.filterReferences([pushRef, createdRef], 'branchCreated');

      expect(result).toEqual([createdRef]);
    });

    test('branchCreated filter returns empty when no created references exist', ({ codeCommitReference }) => {
      const pushRef = codeCommitReference();

      // @ts-expect-error - testing private method directly
      const result = matcher.filterReferences([pushRef], 'branchCreated');

      expect(result).toHaveLength(0);
    });

    test('branchDeleted filter returns only references with deleted true', ({ codeCommitReference }) => {
      const pushRef = codeCommitReference();
      const deletedRef = codeCommitReference({ deleted: true });

      // @ts-expect-error - testing private method directly
      const result = matcher.filterReferences([pushRef, deletedRef], 'branchDeleted');

      expect(result).toEqual([deletedRef]);
    });

    test('branchDeleted filter returns empty when no deleted references exist', ({ codeCommitReference }) => {
      const pushRef = codeCommitReference();

      // @ts-expect-error - testing private method directly
      const result = matcher.filterReferences([pushRef], 'branchDeleted');

      expect(result).toHaveLength(0);
    });
  });

  suite('matchRoute', () => {
    test('matches route by eventSourceArn', async ({ codeCommitRecord }) => {
      const eventSourceArn = 'arn:aws:codecommit:us-east-1:123456789012:my-repo';
      matcher.route(
        defineRoute({
          filters: { eventSourceArn: eventSourceArn },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({ eventSourceARN: eventSourceArn });
      // @ts-expect-error - testing private method directly
      const route = matcher.routes[0];
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(route, record);

      expect(result).toBeDefined();
    });

    test('matches route by eventSourceArn array', async ({ codeCommitRecord }) => {
      const eventSourceArn = 'arn:aws:codecommit:us-east-1:123456789012:my-repo';
      const eventSourceArn2 = 'arn:aws:codecommit:us-east-1:123456789012:other-repo';
      matcher.route(
        defineRoute({
          filters: { eventSourceArn: [eventSourceArn, eventSourceArn2] },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({ eventSourceARN: eventSourceArn });
      // @ts-expect-error - testing private method directly
      const route = matcher.routes[0];
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(route, record);

      expect(result).toBeDefined();
    });

    test('does not match route when eventSourceArn does not match', async ({ codeCommitRecord }) => {
      matcher.route(
        defineRoute({
          filters: { eventSourceArn: 'arn:aws:codecommit:us-east-1:123456789012:other-repo' },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({ eventSourceARN: 'arn:aws:codecommit:us-east-1:123456789012:my-repo' });
      // @ts-expect-error - testing private method directly
      const route = matcher.routes[0];
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(route, record);

      expect(result).toBeUndefined();
    });

    test('matches route by repositoryName', async ({ codeCommitRecord }) => {
      matcher.route(
        defineRoute({
          filters: { repositoryName: 'my-repo' },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({ eventSourceARN: 'arn:aws:codecommit:us-east-1:123456789012:my-repo' });
      // @ts-expect-error - testing private method directly
      const route = matcher.routes[0];
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(route, record);

      expect(result).toBeDefined();
    });

    test('does not match when repositoryName is an empty string', async ({ codeCommitRecord }) => {
      matcher.route(
        defineRoute({
          filters: { repositoryName: '' },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({ eventSourceARN: 'arn:aws:codecommit:us-east-1:123456789012:my-repo' });
      // @ts-expect-error - testing private method directly
      const route = matcher.routes[0];
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(route, record);

      expect(result).toBeUndefined();
    });

    test('matches route by repositoryName array', async ({ codeCommitRecord }) => {
      matcher.route(
        defineRoute({
          filters: { repositoryName: ['my-repo', 'other-repo'] },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({ eventSourceARN: 'arn:aws:codecommit:us-east-1:123456789012:my-repo' });
      // @ts-expect-error - testing private method directly
      const route = matcher.routes[0];
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(route, record);

      expect(result).toBeDefined();
    });

    test('does not match route when repositoryName does not match', async ({ codeCommitRecord }) => {
      matcher.route(
        defineRoute({
          filters: { repositoryName: 'other-repo' },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({ eventSourceARN: 'arn:aws:codecommit:us-east-1:123456789012:my-repo' });
      // @ts-expect-error - testing private method directly
      const route = matcher.routes[0];
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(route, record);

      expect(result).toBeUndefined();
    });

    test('matches route by branch', async ({ codeCommitRecord, codeCommitReference }) => {
      matcher.route(
        defineRoute({
          filters: { branch: 'main' },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({
        codecommit: { references: [codeCommitReference({ ref: 'refs/heads/main' })] },
      });
      // @ts-expect-error - testing private method directly
      const route = matcher.routes[0];
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(route, record);

      expect(result).toBeDefined();
    });

    test('matches route by branch array', async ({ codeCommitRecord, codeCommitReference }) => {
      matcher.route(
        defineRoute({
          filters: { branch: ['main', 'other'] },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({
        codecommit: { references: [codeCommitReference({ ref: 'refs/heads/main' })] },
      });
      // @ts-expect-error - testing private method directly
      const route = matcher.routes[0];
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(route, record);

      expect(result).toBeDefined();
    });

    test('does not match route when branch does not match', async ({ codeCommitRecord, codeCommitReference }) => {
      matcher.route(
        defineRoute({
          filters: { branch: 'develop' },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({
        codecommit: { references: [codeCommitReference({ ref: 'refs/heads/main' })] },
      });
      // @ts-expect-error - testing private method directly
      const route = matcher.routes[0];
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(route, record);

      expect(result).toBeUndefined();
    });

    test('matches route by branch wildcard', async ({ codeCommitRecord, codeCommitReference }) => {
      matcher.route(
        defineRoute({
          filters: { branch: '*deploy*' },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({
        codecommit: { references: [codeCommitReference({ ref: 'refs/heads/auto-deploy-prod' })] },
      });
      // @ts-expect-error - testing private method directly
      const route = matcher.routes[0];
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(route, record);

      expect(result).toBeDefined();
    });

    test('matches route by branch wildcard array', async ({ codeCommitRecord, codeCommitReference }) => {
      matcher.route(
        defineRoute({
          filters: { branch: ['*deploy*', '*hotfix*'] },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({
        codecommit: { references: [codeCommitReference({ ref: 'refs/heads/auto-deploy-prod' })] },
      });
      // @ts-expect-error - testing private method directly
      const route = matcher.routes[0];
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(route, record);

      expect(result).toBeDefined();
    });

    test('does not match route when branch wildcard does not match', async ({
      codeCommitRecord,
      codeCommitReference,
    }) => {
      matcher.route(
        defineRoute({
          filters: { branch: '*deploy*' },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({
        codecommit: { references: [codeCommitReference({ ref: 'refs/heads/feature/thing' })] },
      });
      // @ts-expect-error - testing private method directly
      const route = matcher.routes[0];
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(route, record);

      expect(result).toBeUndefined();
    });

    test('matches route by custom', async ({ codeCommitRecord }) => {
      matcher.route(
        defineRoute({
          filters: {
            custom: ({ userIdentityARN }: CodeCommitFilterInput): boolean => {
              return userIdentityARN.includes('test-user');
            },
          },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({ userIdentityARN: 'arn:aws:iam::123456789012:user/test-user' });
      // @ts-expect-error - testing private method directly
      const route = matcher.routes[0];
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(route, record);

      expect(result).toBeDefined();
    });

    test('does not match route when custom returns false', async ({ codeCommitRecord }) => {
      matcher.route(
        defineRoute({
          filters: { custom: (): boolean => false },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord();
      // @ts-expect-error - testing private method directly
      const route = matcher.routes[0];
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(route, record);

      expect(result).toBeUndefined();
    });

    test('custom receives correct arguments', async ({ codeCommitRecord, codeCommitReference }) => {
      const custom = vi.fn().mockReturnValue(true);
      matcher.route(
        defineRoute({
          filters: { custom },
        }).handle(async () => {}),
      );

      const reference = codeCommitReference({ ref: 'refs/heads/main' });
      const record = codeCommitRecord({
        codecommit: { references: [reference] },
        userIdentityARN: 'arn:aws:iam::123456789012:user/deploy-bot',
        eventSourceARN: 'arn:aws:codecommit:us-east-1:123456789012:my-repo',
        eventTriggerName: 'my-trigger',
      });

      // @ts-expect-error - testing private method directly
      const route = matcher.routes[0];
      // @ts-expect-error - testing private method directly
      await matcher.matchRoute(route, record);

      expect(custom).toHaveBeenCalledWith({
        references: [reference],
        userIdentityARN: 'arn:aws:iam::123456789012:user/deploy-bot',
        eventSourceARN: 'arn:aws:codecommit:us-east-1:123456789012:my-repo',
        eventTriggerName: 'my-trigger',
      });
    });

    test('matches route by async custom', async ({ codeCommitRecord }) => {
      matcher.route(
        defineRoute({
          filters: {
            custom: async ({ userIdentityARN }: CodeCommitFilterInput): Promise<boolean> => {
              await new Promise((r) => setTimeout(r, 1));
              return userIdentityARN.includes('async-user');
            },
          },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({ userIdentityARN: 'arn:aws:iam::123456789012:user/async-user' });
      // @ts-expect-error - testing private method directly
      const route = matcher.routes[0];
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(route, record);

      expect(result).toBeDefined();
    });

    test('matches route with empty filters as a catch-all', async ({ codeCommitRecord }) => {
      matcher.route(
        defineRoute({
          filters: {},
        }).handle(async () => {}),
      );

      const record = codeCommitRecord();
      // @ts-expect-error - testing private method directly
      const route = matcher.routes[0];
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(route, record);

      expect(result).toBeDefined();
    });

    test('referenceFilter push filters references before branch matching', async ({
      codeCommitRecord,
      codeCommitReference,
    }) => {
      matcher.push(
        defineRoute({
          filters: { branch: 'main' },
        }).handle(async () => {}),
      );

      const pushRef = codeCommitReference({ ref: 'refs/heads/main' });
      const createdRef = codeCommitReference({ ref: 'refs/heads/main', created: true });
      const record = codeCommitRecord({
        codecommit: { references: [pushRef, createdRef] },
      });
      // @ts-expect-error - testing private method directly
      const route = matcher.routes[0];
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(route, record);

      expect(result).toBeDefined();
      expect(result?.references).toEqual([pushRef]);
    });

    test('returns undefined when referenceFilter yields no matching references', async ({
      codeCommitRecord,
      codeCommitReference,
    }) => {
      matcher.push(
        defineRoute({
          filters: {},
        }).handle(async () => {}),
      );

      const createdRef = codeCommitReference({ ref: 'refs/heads/main', created: true });
      const record = codeCommitRecord({
        codecommit: { references: [createdRef] },
      });
      // @ts-expect-error - testing private method directly
      const route = matcher.routes[0];
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(route, record);

      expect(result).toBeUndefined();
    });

    test('custom receives filtered references when referenceFilter is set', async ({
      codeCommitRecord,
      codeCommitReference,
    }) => {
      const custom = vi.fn().mockReturnValue(true);
      matcher.push(
        defineRoute({
          filters: { custom },
        }).handle(async () => {}),
      );

      const pushRef = codeCommitReference({ ref: 'refs/heads/main' });
      const createdRef = codeCommitReference({ ref: 'refs/heads/main', created: true });
      const record = codeCommitRecord({
        codecommit: { references: [pushRef, createdRef] },
      });
      // @ts-expect-error - testing private method directly
      const route = matcher.routes[0];
      // @ts-expect-error - testing private method directly
      await matcher.matchRoute(route, record);

      expect(custom).toHaveBeenCalledWith(
        expect.objectContaining({
          references: [pushRef],
        }),
      );
    });

    test('custom is not called when an earlier filter fails', async ({ codeCommitRecord }) => {
      const custom = vi.fn().mockReturnValue(true);
      matcher.route(
        defineRoute({
          filters: {
            eventSourceArn: 'arn:aws:codecommit:us-east-1:123456789012:other-repo',
            custom,
          },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({ eventSourceARN: 'arn:aws:codecommit:us-east-1:123456789012:my-repo' });
      // @ts-expect-error - testing private method directly
      const route = matcher.routes[0];
      // @ts-expect-error - testing private method directly
      await matcher.matchRoute(route, record);

      expect(custom).not.toHaveBeenCalled();
    });

    test('matches when both eventSourceArns and branches match', async ({ codeCommitRecord, codeCommitReference }) => {
      const eventSourceArn = 'arn:aws:codecommit:us-east-1:123456789012:my-repo';
      matcher.route(
        defineRoute({
          filters: {
            eventSourceArn: eventSourceArn,
            branch: 'main',
          },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({
        eventSourceARN: eventSourceArn,
        codecommit: { references: [codeCommitReference({ ref: 'refs/heads/main' })] },
      });
      // @ts-expect-error - testing private method directly
      const route = matcher.routes[0];
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(route, record);

      expect(result).toBeDefined();
    });

    test('does not match when eventSourceArns matches but branches does not', async ({
      codeCommitRecord,
      codeCommitReference,
    }) => {
      const eventSourceArn = 'arn:aws:codecommit:us-east-1:123456789012:my-repo';
      matcher.route(
        defineRoute({
          filters: {
            eventSourceArn: eventSourceArn,
            branch: 'develop',
          },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({
        eventSourceARN: eventSourceArn,
        codecommit: { references: [codeCommitReference({ ref: 'refs/heads/main' })] },
      });
      // @ts-expect-error - testing private method directly
      const route = matcher.routes[0];
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(route, record);

      expect(result).toBeUndefined();
    });

    test('extracts branch name from refs/heads/ prefix for branch filters', async ({
      codeCommitRecord,
      codeCommitReference,
    }) => {
      matcher.route(
        defineRoute({
          filters: { branch: 'feature/deep/nested' },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({
        codecommit: { references: [codeCommitReference({ ref: 'refs/heads/feature/deep/nested' })] },
      });
      // @ts-expect-error - testing private method directly
      const route = matcher.routes[0];
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(route, record);

      expect(result).toBeDefined();
    });
  });

  suite('matchRoutes', () => {
    test('returns all matching routes, not just the first', async ({ codeCommitRecord }) => {
      const handlerA = vi.fn();
      const handlerB = vi.fn();
      matcher.route(defineRoute({ filters: {} }).handle(handlerA));
      matcher.route(defineRoute({ filters: {} }).handle(handlerB));

      const record = codeCommitRecord();
      // @ts-expect-error - testing private method directly
      const results = await matcher.matchRoutes(record);

      expect(results).toHaveLength(2);
    });

    test('multiple routes match same record with different reference subsets', async ({
      codeCommitRecord,
      codeCommitReference,
    }) => {
      matcher.push(defineRoute({ filters: {} }).handle(async () => {}));
      matcher.branchCreated(defineRoute({ filters: {} }).handle(async () => {}));

      const pushRef = codeCommitReference({ ref: 'refs/heads/main' });
      const createdRef = codeCommitReference({ ref: 'refs/heads/feature', created: true });
      const record = codeCommitRecord({
        codecommit: { references: [pushRef, createdRef] },
      });
      // @ts-expect-error - testing private method directly
      const results = await matcher.matchRoutes(record);

      expect(results).toHaveLength(2);
      // @ts-expect-error - results[0] is asserted by length check above
      expect(results[0].references).toEqual([pushRef]);
      // @ts-expect-error - results[1] is asserted by length check above
      expect(results[1].references).toEqual([createdRef]);
    });

    test('non-matching routes are skipped', async ({ codeCommitRecord }) => {
      const handlerA = vi.fn();
      const handlerB = vi.fn();
      matcher.route(
        defineRoute({
          filters: { eventSourceArn: 'arn:aws:codecommit:us-east-1:123456789012:other-repo' },
        }).handle(handlerA),
      );
      matcher.route(defineRoute({ filters: {} }).handle(handlerB));

      const record = codeCommitRecord({ eventSourceARN: 'arn:aws:codecommit:us-east-1:123456789012:my-repo' });
      // @ts-expect-error - testing private method directly
      const results = await matcher.matchRoutes(record);

      expect(results).toHaveLength(1);
      // @ts-expect-error - results[0] is asserted by length check above
      expect(results[0].route.handler).toBe(handlerB);
    });

    test('returns empty array when no routes match', async ({ codeCommitRecord }) => {
      matcher.route(
        defineRoute({
          filters: { eventSourceArn: 'arn:aws:codecommit:us-east-1:123456789012:other-repo' },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({ eventSourceARN: 'arn:aws:codecommit:us-east-1:123456789012:my-repo' });
      // @ts-expect-error - testing private method directly
      const results = await matcher.matchRoutes(record);

      expect(results).toHaveLength(0);
    });
  });

  suite('processRecord', () => {
    test('throws when no route matches', async ({ codeCommitRecord, context }) => {
      const record = codeCommitRecord();

      // @ts-expect-error - testing private method directly
      await expect(matcher.processRecord(record, context())).rejects.toThrow(
        `No route matched for CodeCommit record ${record.eventId}`,
      );
    });

    test('passes correct CodeCommitRequest shape to handler', async ({
      codeCommitRecord,
      codeCommitReference,
      context,
    }) => {
      const handler = vi.fn();
      matcher.route(defineRoute({ filters: {} }).handle(handler));

      const reference = codeCommitReference({ ref: 'refs/heads/main' });
      const mockContext = context();
      const record = codeCommitRecord({
        codecommit: { references: [reference] },
        userIdentityARN: 'arn:aws:iam::123456789012:user/test-user',
        eventTriggerName: 'my-trigger',
        eventSourceARN: 'arn:aws:codecommit:us-east-1:123456789012:my-repo',
      });

      // @ts-expect-error - testing private method directly
      await matcher.processRecord(record, mockContext);

      expect(handler).toHaveBeenCalledWith({
        references: [reference],
        userIdentityARN: 'arn:aws:iam::123456789012:user/test-user',
        eventTriggerName: 'my-trigger',
        eventSourceARN: 'arn:aws:codecommit:us-east-1:123456789012:my-repo',
        record,
        context: mockContext,
      });
    });

    test('handler receives filtered references, not all references', async ({
      codeCommitRecord,
      codeCommitReference,
      context,
    }) => {
      const handler = vi.fn();

      matcher.push(defineRoute({ filters: {} }).handle(handler));

      const pushRef = codeCommitReference({ ref: 'refs/heads/main' });
      const createdRef = codeCommitReference({ ref: 'refs/heads/feature', created: true });
      const record = codeCommitRecord({
        codecommit: { references: [pushRef, createdRef] },
      });
      // @ts-expect-error - testing private method directly
      await matcher.processRecord(record, context());

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          references: [pushRef],
        }),
      );
    });

    test('executes multiple matched handlers in parallel', async ({ codeCommitRecord, context }) => {
      const callOrder: string[] = [];
      const handlerA = vi.fn(async () => {
        callOrder.push('start-A');
        await new Promise((resolve) => setTimeout(resolve, 1));
        callOrder.push('end-A');
      });
      const handlerB = vi.fn(async () => {
        callOrder.push('start-B');
        await new Promise((resolve) => setTimeout(resolve, 1));
        callOrder.push('end-B');
      });

      matcher.route(defineRoute({ filters: {} }).handle(handlerA));
      matcher.route(defineRoute({ filters: {} }).handle(handlerB));

      const record = codeCommitRecord();
      // @ts-expect-error - testing private method directly
      await matcher.processRecord(record, context());

      // Parallel: both start before either finishes
      expect(callOrder[0]).toBe('start-A');
      expect(callOrder[1]).toBe('start-B');
    });

    test('propagates handler error', async ({ codeCommitRecord, context }) => {
      matcher.route(
        defineRoute({ filters: {} }).handle(async () => {
          throw new Error('handler exploded');
        }),
      );

      const record = codeCommitRecord();
      // @ts-expect-error - testing private method directly
      await expect(matcher.processRecord(record, context())).rejects.toThrow('handler exploded');
    });

    test('calls all matched handlers even when they handle different reference subsets', async ({
      codeCommitRecord,
      codeCommitReference,
      context,
    }) => {
      const pushHandler = vi.fn();
      const createHandler = vi.fn();
      matcher.push(defineRoute({ filters: {} }).handle(pushHandler));
      matcher.branchCreated(defineRoute({ filters: {} }).handle(createHandler));

      const pushRef = codeCommitReference({ ref: 'refs/heads/main' });
      const createdRef = codeCommitReference({ ref: 'refs/heads/feature', created: true });
      const record = codeCommitRecord({
        codecommit: { references: [pushRef, createdRef] },
      });
      // @ts-expect-error - testing private method directly
      await matcher.processRecord(record, context());

      expect(pushHandler).toHaveBeenCalledTimes(1);
      expect(createHandler).toHaveBeenCalledTimes(1);
      expect(pushHandler).toHaveBeenCalledWith(expect.objectContaining({ references: [pushRef] }));
      expect(createHandler).toHaveBeenCalledWith(expect.objectContaining({ references: [createdRef] }));
    });
  });

  suite('handleEvent', () => {
    test('returns undefined on success', async ({ codeCommitHandlerEvent }) => {
      matcher.route(defineRoute({ filters: {} }).handle(async () => {}));

      const { event, context } = codeCommitHandlerEvent();
      const result = await matcher.handleEvent(event, context);

      expect(result).toBeUndefined();
    });

    test('throws when no route matches', async ({ codeCommitHandlerEvent }) => {
      const { event, context } = codeCommitHandlerEvent();
      await expect(matcher.handleEvent(event, context)).rejects.toThrow('No route matched');
    });

    test('propagates handler errors', async ({ codeCommitHandlerEvent }) => {
      matcher.route(
        defineRoute({ filters: {} }).handle(async () => {
          throw new Error('handler exploded');
        }),
      );

      const { event, context } = codeCommitHandlerEvent();
      await expect(matcher.handleEvent(event, context)).rejects.toThrow('handler exploded');
    });

    test('processes multiple records in parallel', async ({ codeCommitRecord, codeCommitEvent, context }) => {
      const callOrder: string[] = [];

      matcher.route(
        defineRoute({ filters: {} }).handle(async (request) => {
          const eventId = request.record.eventId;
          callOrder.push(`start-${eventId}`);
          await new Promise((resolve) => setTimeout(resolve, 1));
          callOrder.push(`end-${eventId}`);
        }),
      );

      const recordA = codeCommitRecord();
      const recordB = codeCommitRecord();
      const event = codeCommitEvent([recordA, recordB]);
      await matcher.handleEvent(event, context());

      // Parallel: both start before either finishes
      expect(callOrder[0]).toBe(`start-${recordA.eventId}`);
      expect(callOrder[1]).toBe(`start-${recordB.eventId}`);
    });

    test('calls the matched handler with correct request shape', async ({
      codeCommitRecord,
      codeCommitReference,
      codeCommitEvent,
      context,
    }) => {
      const handler = vi.fn();
      const eventSourceArn = 'arn:aws:codecommit:us-east-1:123456789012:my-repo';
      matcher.route(
        defineRoute({
          filters: { eventSourceArn: eventSourceArn },
        }).handle(handler),
      );

      const reference = codeCommitReference({ ref: 'refs/heads/main' });
      const record = codeCommitRecord({
        eventSourceARN: eventSourceArn,
        codecommit: { references: [reference] },
      });
      const event = codeCommitEvent([record]);
      const mockContext = context();
      await matcher.handleEvent(event, mockContext);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          references: [reference],
          record: event.Records[0],
          context: mockContext,
        }),
      );
    });

    test('multiple routes match same record with different reference subsets', async ({
      codeCommitRecord,
      codeCommitReference,
      codeCommitEvent,
      context,
    }) => {
      const pushHandler = vi.fn();
      const createHandler = vi.fn();

      matcher.push(defineRoute({ filters: {} }).handle(pushHandler));
      matcher.branchCreated(defineRoute({ filters: {} }).handle(createHandler));

      const pushRef = codeCommitReference({ ref: 'refs/heads/main' });
      const createdRef = codeCommitReference({ ref: 'refs/heads/feature', created: true });
      const record = codeCommitRecord({
        codecommit: { references: [pushRef, createdRef] },
      });
      const event = codeCommitEvent([record]);
      await matcher.handleEvent(event, context());

      expect(pushHandler).toHaveBeenCalledTimes(1);
      expect(createHandler).toHaveBeenCalledTimes(1);
      expect(pushHandler).toHaveBeenCalledWith(expect.objectContaining({ references: [pushRef] }));
      expect(createHandler).toHaveBeenCalledWith(expect.objectContaining({ references: [createdRef] }));
    });

    test('handles multiple records each matching different routes', async ({
      codeCommitRecord,
      codeCommitReference,
      codeCommitEvent,
      context,
    }) => {
      const repoAHandler = vi.fn();
      const repoBHandler = vi.fn();
      matcher.route(
        defineRoute({
          filters: { repositoryName: 'repo-a' },
        }).handle(repoAHandler),
      );
      matcher.route(
        defineRoute({
          filters: { repositoryName: 'repo-b' },
        }).handle(repoBHandler),
      );

      const recordA = codeCommitRecord({
        eventSourceARN: 'arn:aws:codecommit:us-east-1:123456789012:repo-a',
        codecommit: { references: [codeCommitReference()] },
      });
      const recordB = codeCommitRecord({
        eventSourceARN: 'arn:aws:codecommit:us-east-1:123456789012:repo-b',
        codecommit: { references: [codeCommitReference()] },
      });
      const event = codeCommitEvent([recordA, recordB]);
      await matcher.handleEvent(event, context());

      expect(repoAHandler).toHaveBeenCalledTimes(1);
      expect(repoBHandler).toHaveBeenCalledTimes(1);
    });
  });

  suite('full event processing', () => {
    test('routes records to different handlers by reference type', async ({
      codeCommitRecord,
      codeCommitReference,
      codeCommitEvent,
      context,
    }) => {
      const pushHandler = vi.fn();
      const createHandler = vi.fn();
      const deleteHandler = vi.fn();
      matcher.push(defineRoute({ filters: {} }).handle(pushHandler));
      matcher.branchCreated(defineRoute({ filters: {} }).handle(createHandler));
      matcher.branchDeleted(defineRoute({ filters: {} }).handle(deleteHandler));

      const pushRecord = codeCommitRecord({
        codecommit: { references: [codeCommitReference()] },
      });
      const createRecord = codeCommitRecord({
        codecommit: { references: [codeCommitReference({ created: true })] },
      });
      const deleteRecord = codeCommitRecord({
        codecommit: { references: [codeCommitReference({ deleted: true })] },
      });

      const event = codeCommitEvent([pushRecord, createRecord, deleteRecord]);
      await matcher.handleEvent(event, context());

      expect(pushHandler).toHaveBeenCalledTimes(1);
      expect(createHandler).toHaveBeenCalledTimes(1);
      expect(deleteHandler).toHaveBeenCalledTimes(1);
    });

    test('handles mixed references in a single record across multiple routes', async ({
      codeCommitRecord,
      codeCommitReference,
      codeCommitEvent,
      context,
    }) => {
      const pushHandler = vi.fn();
      const createHandler = vi.fn();
      const deleteHandler = vi.fn();
      matcher.push(defineRoute({ filters: {} }).handle(pushHandler));
      matcher.branchCreated(defineRoute({ filters: {} }).handle(createHandler));
      matcher.branchDeleted(defineRoute({ filters: {} }).handle(deleteHandler));

      const pushRef = codeCommitReference({ ref: 'refs/heads/main' });
      const createdRef = codeCommitReference({ ref: 'refs/heads/feature', created: true });
      const deletedRef = codeCommitReference({ ref: 'refs/heads/old-branch', deleted: true });

      const record = codeCommitRecord({
        codecommit: { references: [pushRef, createdRef, deletedRef] },
      });
      const event = codeCommitEvent([record]);
      await matcher.handleEvent(event, context());

      expect(pushHandler).toHaveBeenCalledTimes(1);
      expect(pushHandler).toHaveBeenCalledWith(expect.objectContaining({ references: [pushRef] }));
      expect(createHandler).toHaveBeenCalledTimes(1);
      expect(createHandler).toHaveBeenCalledWith(expect.objectContaining({ references: [createdRef] }));
      expect(deleteHandler).toHaveBeenCalledTimes(1);
      expect(deleteHandler).toHaveBeenCalledWith(expect.objectContaining({ references: [deletedRef] }));
    });

    test('catch-all route with specific routes processes all records correctly', async ({
      codeCommitRecord,
      codeCommitReference,
      codeCommitEvent,
      context,
    }) => {
      const mainHandler = vi.fn();
      const catchAllHandler = vi.fn();
      matcher.push(defineRoute({ filters: { branch: 'main' } }).handle(mainHandler));
      matcher.route(defineRoute({ filters: {} }).handle(catchAllHandler));

      const mainRef = codeCommitReference({ ref: 'refs/heads/main' });
      const featureRef = codeCommitReference({ ref: 'refs/heads/feature' });

      const mainRecord = codeCommitRecord({
        codecommit: { references: [mainRef] },
      });
      const featureRecord = codeCommitRecord({
        codecommit: { references: [featureRef] },
      });

      const event = codeCommitEvent([mainRecord, featureRecord]);
      await matcher.handleEvent(event, context());

      // main record matches both push (main branch) and catch-all
      expect(mainHandler).toHaveBeenCalledTimes(1);
      // catch-all matches both records
      expect(catchAllHandler).toHaveBeenCalledTimes(2);
    });
  });

  suite('matcher-level middleware', () => {
    test('executes middleware before the route handler', async ({ codeCommitHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middleware(request: CodeCommitRequest, next: CodeCommitNext): Promise<void> {
        callOrder.push('mw-pre');
        await next(request);
        callOrder.push('mw-post');
      }

      const matcher = createCodeCommitMatcher({ middleware: [middleware] });
      matcher.route(
        defineRoute({ filters: {} }).handle(async () => {
          callOrder.push('handler');
        }),
      );

      const { event, context } = codeCommitHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
    });

    test('allows middleware to skip a record by not calling next', async ({ codeCommitHandlerEvent }) => {
      const handler = vi.fn();

      async function skipMiddleware(_request: CodeCommitRequest, _next: CodeCommitNext): Promise<void> {
        return;
      }

      const matcher = createCodeCommitMatcher({ middleware: [skipMiddleware] });
      matcher.route(defineRoute({ filters: {} }).handle(handler));

      const { event, context } = codeCommitHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple matcher-level middleware in order', async ({ codeCommitHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middlewareOne(request: CodeCommitRequest, next: CodeCommitNext): Promise<void> {
        callOrder.push('mw1');
        await next(request);
      }

      async function middlewareTwo(request: CodeCommitRequest, next: CodeCommitNext): Promise<void> {
        callOrder.push('mw2');
        await next(request);
      }

      const matcher = createCodeCommitMatcher({ middleware: [middlewareOne, middlewareTwo] });
      matcher.route(
        defineRoute({ filters: {} }).handle(async () => {
          callOrder.push('handler');
        }),
      );

      const { event, context } = codeCommitHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['mw1', 'mw2', 'handler']);
    });

    test('executes middleware per matched route', async ({
      codeCommitRecord,
      codeCommitReference,
      codeCommitEvent,
      context,
    }) => {
      const callOrder: string[] = [];

      async function middleware(request: CodeCommitRequest, next: CodeCommitNext): Promise<void> {
        callOrder.push('mw');
        await next(request);
      }

      const matcher = createCodeCommitMatcher({ middleware: [middleware] });
      matcher.push(
        defineRoute({ filters: {} }).handle(async () => {
          callOrder.push('push-handler');
        }),
      );
      matcher.branchCreated(
        defineRoute({ filters: {} }).handle(async () => {
          callOrder.push('create-handler');
        }),
      );

      const pushRef = codeCommitReference({ ref: 'refs/heads/main' });
      const createdRef = codeCommitReference({ ref: 'refs/heads/feature', created: true });
      const record = codeCommitRecord({
        codecommit: { references: [pushRef, createdRef] },
      });
      const event = codeCommitEvent([record]);
      await matcher.handleEvent(event, context());

      // Middleware runs once per matched route (two routes match)
      const middlewareCount = callOrder.filter((entry) => entry === 'mw').length;
      expect(middlewareCount).toBe(2);
    });
  });

  suite('route-level middleware', () => {
    test('executes route-level middleware for a specific route', async ({ codeCommitHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: CodeCommitRequest, next: CodeCommitNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      matcher.route(
        defineRoute({ filters: {}, middleware: [routeMiddleware] }).handle(async () => {
          callOrder.push('handler');
        }),
      );

      const { event, context } = codeCommitHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });

    test('allows route-level middleware to short-circuit by not calling next', async ({ codeCommitHandlerEvent }) => {
      const handler = vi.fn();

      async function blockingRouteMiddleware(_request: CodeCommitRequest, _next: CodeCommitNext): Promise<void> {
        return;
      }
      matcher.route(defineRoute({ filters: {}, middleware: [blockingRouteMiddleware] }).handle(handler));

      const { event, context } = codeCommitHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple route-level middleware in order', async ({ codeCommitHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddlewareOne(request: CodeCommitRequest, next: CodeCommitNext): Promise<void> {
        callOrder.push('route-mw1');
        await next(request);
      }

      async function routeMiddlewareTwo(request: CodeCommitRequest, next: CodeCommitNext): Promise<void> {
        callOrder.push('route-mw2');
        await next(request);
      }
      matcher.route(
        defineRoute({ filters: {}, middleware: [routeMiddlewareOne, routeMiddlewareTwo] }).handle(async () => {
          callOrder.push('handler');
        }),
      );

      const { event, context } = codeCommitHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw1', 'route-mw2', 'handler']);
    });

    test('supports middleware on defineRoute builder pattern', async ({ codeCommitHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: CodeCommitRequest, next: CodeCommitNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      const route = defineRoute({ filters: {}, middleware: [routeMiddleware] }).handle(async () => {
        callOrder.push('handler');
      });
      matcher.route(route);

      const { event, context } = codeCommitHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });
  });

  suite('combined matcher and route middleware', () => {
    test('executes matcher middleware before route middleware', async ({ codeCommitHandlerEvent }) => {
      const callOrder: string[] = [];

      async function matcherMiddleware(request: CodeCommitRequest, next: CodeCommitNext): Promise<void> {
        callOrder.push('matcher-mw');
        await next(request);
      }

      async function routeMiddleware(request: CodeCommitRequest, next: CodeCommitNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      const matcher = createCodeCommitMatcher({ middleware: [matcherMiddleware] });
      matcher.route(
        defineRoute({ filters: {}, middleware: [routeMiddleware] }).handle(async () => {
          callOrder.push('handler');
        }),
      );

      const { event, context } = codeCommitHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['matcher-mw', 'route-mw', 'handler']);
    });

    test('matcher middleware short-circuit prevents route middleware from running', async ({
      codeCommitHandlerEvent,
    }) => {
      const routeMiddleware = vi.fn();
      const handler = vi.fn();

      async function blockingMatcherMiddleware(_request: CodeCommitRequest, _next: CodeCommitNext): Promise<void> {
        return;
      }

      const matcher = createCodeCommitMatcher({ middleware: [blockingMatcherMiddleware] });
      matcher.route(defineRoute({ filters: {}, middleware: [routeMiddleware] }).handle(handler));

      const { event, context } = codeCommitHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(routeMiddleware).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });
  });
});

suite('CodeCommitMatcher.canHandleEvent', () => {
  const ownEvents = ['createCodeCommitEvent'];

  test.each(allEventBuilders())('%s', async (name, build) => {
    const event = build();
    const isOwnEvent = ownEvents.includes(name);

    const claimed = await createCodeCommitMatcher().canHandleEvent(event);

    expect(claimed).toBe(isOwnEvent);
  });
});
