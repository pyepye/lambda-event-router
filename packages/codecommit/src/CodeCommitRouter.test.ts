import { createCodeCommitEvent, test } from '@lambda-event-router/testing';
import { CodeCommitRouter, createCodeCommitRouter, defineRoute } from './CodeCommitRouter.js';
import type { CodeCommitFilterInput, CodeCommitRequest } from './types.js';

type CodeCommitNext = (request: CodeCommitRequest) => Promise<void>;

suite('CodeCommitRouter', () => {
  let router: CodeCommitRouter;

  beforeEach(() => {
    router = new CodeCommitRouter();
  });

  suite('createCodeCommitRouter', () => {
    test('creates a CodeCommitRouter instance', () => {
      const router = createCodeCommitRouter();
      expect(router).toBeInstanceOf(CodeCommitRouter);
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for a valid CodeCommit event', () => {
      const event = createCodeCommitEvent();
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns false for a non-CodeCommit event', () => {
      const event = { detail: { foo: 'bar' }, source: 'custom.app' };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for null', () => {
      expect(router.canHandleEvent(null)).toBe(false);
    });

    test('returns false for a string', () => {
      expect(router.canHandleEvent('not an event')).toBe(false);
    });

    test('returns false when Records is not an array', () => {
      expect(router.canHandleEvent({ Records: 'not-an-array' })).toBe(false);
    });

    test('returns false when first record is not an object', () => {
      expect(router.canHandleEvent({ Records: ['not-an-object'] })).toBe(false);
    });

    test('returns false when eventSource is not aws:codecommit', () => {
      expect(router.canHandleEvent({ Records: [{ eventSource: 'aws:sqs' }] })).toBe(false);
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
    test('returns the router instance for chaining', () => {
      const definition = defineRoute({
        filters: {},
      }).handle(async () => {});

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  suite('push', () => {
    test('returns the router instance for chaining', () => {
      const definition = defineRoute({
        filters: {},
      }).handle(async () => {});

      const result = router.push(definition);

      expect(result).toBe(router);
    });

    test('only matches push references', ({ codeCommitRecord, codeCommitReference }) => {
      router.push(defineRoute({ filters: {} }).handle(async () => {}));

      const pushRef = codeCommitReference({ ref: 'refs/heads/main' });
      const createdRef = codeCommitReference({ ref: 'refs/heads/feature', created: true });
      const deletedRef = codeCommitReference({ ref: 'refs/heads/old-branch', deleted: true });
      const record = codeCommitRecord({
        codecommit: { references: [pushRef, createdRef, deletedRef] },
      });
      // @ts-expect-error - testing private method directly
      const route = router.routes[0];
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(route, record);

      expect(result).toBeDefined();
      expect(result?.references).toEqual([pushRef]);
    });
  });

  suite('branchCreated', () => {
    test('returns the router instance for chaining', () => {
      const definition = defineRoute({
        filters: {},
      }).handle(async () => {});

      const result = router.branchCreated(definition);

      expect(result).toBe(router);
    });

    test('only matches created references', ({ codeCommitRecord, codeCommitReference }) => {
      router.branchCreated(defineRoute({ filters: {} }).handle(async () => {}));

      const pushRef = codeCommitReference({ ref: 'refs/heads/main' });
      const createdRef = codeCommitReference({ ref: 'refs/heads/feature', created: true });
      const deletedRef = codeCommitReference({ ref: 'refs/heads/old-branch', deleted: true });
      const record = codeCommitRecord({
        codecommit: { references: [pushRef, createdRef, deletedRef] },
      });
      // @ts-expect-error - testing private method directly
      const route = router.routes[0];
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(route, record);

      expect(result).toBeDefined();
      expect(result?.references).toEqual([createdRef]);
    });
  });

  suite('branchDeleted', () => {
    test('returns the router instance for chaining', () => {
      const definition = defineRoute({
        filters: {},
      }).handle(async () => {});

      const result = router.branchDeleted(definition);

      expect(result).toBe(router);
    });

    test('only matches deleted references', ({ codeCommitRecord, codeCommitReference }) => {
      router.branchDeleted(defineRoute({ filters: {} }).handle(async () => {}));

      const pushRef = codeCommitReference({ ref: 'refs/heads/main' });
      const createdRef = codeCommitReference({ ref: 'refs/heads/feature', created: true });
      const deletedRef = codeCommitReference({ ref: 'refs/heads/old-branch', deleted: true });
      const record = codeCommitRecord({
        codecommit: { references: [pushRef, createdRef, deletedRef] },
      });
      // @ts-expect-error - testing private method directly
      const route = router.routes[0];
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(route, record);

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
      const result = router.filterReferences([pushRef, createdRef, deletedRef], 'push');

      expect(result).toEqual([pushRef]);
    });

    test('push filter excludes references with created set to true', ({ codeCommitReference }) => {
      const createdRef = codeCommitReference({ created: true });

      // @ts-expect-error - testing private method directly
      const result = router.filterReferences([createdRef], 'push');

      expect(result).toHaveLength(0);
    });

    test('push filter excludes references with deleted set to true', ({ codeCommitReference }) => {
      const deletedRef = codeCommitReference({ deleted: true });

      // @ts-expect-error - testing private method directly
      const result = router.filterReferences([deletedRef], 'push');

      expect(result).toHaveLength(0);
    });

    test('branchCreated filter returns only references with created true', ({ codeCommitReference }) => {
      const pushRef = codeCommitReference();
      const createdRef = codeCommitReference({ created: true });

      // @ts-expect-error - testing private method directly
      const result = router.filterReferences([pushRef, createdRef], 'branchCreated');

      expect(result).toEqual([createdRef]);
    });

    test('branchCreated filter returns empty when no created references exist', ({ codeCommitReference }) => {
      const pushRef = codeCommitReference();

      // @ts-expect-error - testing private method directly
      const result = router.filterReferences([pushRef], 'branchCreated');

      expect(result).toHaveLength(0);
    });

    test('branchDeleted filter returns only references with deleted true', ({ codeCommitReference }) => {
      const pushRef = codeCommitReference();
      const deletedRef = codeCommitReference({ deleted: true });

      // @ts-expect-error - testing private method directly
      const result = router.filterReferences([pushRef, deletedRef], 'branchDeleted');

      expect(result).toEqual([deletedRef]);
    });

    test('branchDeleted filter returns empty when no deleted references exist', ({ codeCommitReference }) => {
      const pushRef = codeCommitReference();

      // @ts-expect-error - testing private method directly
      const result = router.filterReferences([pushRef], 'branchDeleted');

      expect(result).toHaveLength(0);
    });
  });

  suite('matchRoute', () => {
    test('matches route by eventSourceArn', ({ codeCommitRecord }) => {
      const eventSourceArn = 'arn:aws:codecommit:us-east-1:123456789012:my-repo';
      router.route(
        defineRoute({
          filters: { eventSourceArn: eventSourceArn },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({ eventSourceARN: eventSourceArn });
      // @ts-expect-error - testing private method directly
      const route = router.routes[0];
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(route, record);

      expect(result).toBeDefined();
    });

    test('matches route by eventSourceArn array', ({ codeCommitRecord }) => {
      const eventSourceArn = 'arn:aws:codecommit:us-east-1:123456789012:my-repo';
      const eventSourceArn2 = 'arn:aws:codecommit:us-east-1:123456789012:other-repo';
      router.route(
        defineRoute({
          filters: { eventSourceArn: [eventSourceArn, eventSourceArn2] },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({ eventSourceARN: eventSourceArn });
      // @ts-expect-error - testing private method directly
      const route = router.routes[0];
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(route, record);

      expect(result).toBeDefined();
    });

    test('does not match route when eventSourceArn does not match', ({ codeCommitRecord }) => {
      router.route(
        defineRoute({
          filters: { eventSourceArn: 'arn:aws:codecommit:us-east-1:123456789012:other-repo' },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({ eventSourceARN: 'arn:aws:codecommit:us-east-1:123456789012:my-repo' });
      // @ts-expect-error - testing private method directly
      const route = router.routes[0];
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(route, record);

      expect(result).toBeUndefined();
    });

    test('matches route by repositoryName', ({ codeCommitRecord }) => {
      router.route(
        defineRoute({
          filters: { repositoryName: 'my-repo' },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({ eventSourceARN: 'arn:aws:codecommit:us-east-1:123456789012:my-repo' });
      // @ts-expect-error - testing private method directly
      const route = router.routes[0];
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(route, record);

      expect(result).toBeDefined();
    });

    test('matches route by repositoryName array', ({ codeCommitRecord }) => {
      router.route(
        defineRoute({
          filters: { repositoryName: ['my-repo', 'other-repo'] },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({ eventSourceARN: 'arn:aws:codecommit:us-east-1:123456789012:my-repo' });
      // @ts-expect-error - testing private method directly
      const route = router.routes[0];
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(route, record);

      expect(result).toBeDefined();
    });

    test('does not match route when repositoryName does not match', ({ codeCommitRecord }) => {
      router.route(
        defineRoute({
          filters: { repositoryName: 'other-repo' },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({ eventSourceARN: 'arn:aws:codecommit:us-east-1:123456789012:my-repo' });
      // @ts-expect-error - testing private method directly
      const route = router.routes[0];
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(route, record);

      expect(result).toBeUndefined();
    });

    test('matches route by branch', ({ codeCommitRecord, codeCommitReference }) => {
      router.route(
        defineRoute({
          filters: { branch: 'main' },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({
        codecommit: { references: [codeCommitReference({ ref: 'refs/heads/main' })] },
      });
      // @ts-expect-error - testing private method directly
      const route = router.routes[0];
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(route, record);

      expect(result).toBeDefined();
    });

    test('matches route by branch array', ({ codeCommitRecord, codeCommitReference }) => {
      router.route(
        defineRoute({
          filters: { branch: ['main', 'other'] },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({
        codecommit: { references: [codeCommitReference({ ref: 'refs/heads/main' })] },
      });
      // @ts-expect-error - testing private method directly
      const route = router.routes[0];
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(route, record);

      expect(result).toBeDefined();
    });

    test('does not match route when branch does not match', ({ codeCommitRecord, codeCommitReference }) => {
      router.route(
        defineRoute({
          filters: { branch: 'develop' },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({
        codecommit: { references: [codeCommitReference({ ref: 'refs/heads/main' })] },
      });
      // @ts-expect-error - testing private method directly
      const route = router.routes[0];
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(route, record);

      expect(result).toBeUndefined();
    });

    test('matches route by branchPrefix', ({ codeCommitRecord, codeCommitReference }) => {
      router.route(
        defineRoute({
          filters: { branchPrefix: 'feature/' },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({
        codecommit: { references: [codeCommitReference({ ref: 'refs/heads/feature/new-thing' })] },
      });
      // @ts-expect-error - testing private method directly
      const route = router.routes[0];
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(route, record);

      expect(result).toBeDefined();
    });

    test('matches route by branchPrefix array', ({ codeCommitRecord, codeCommitReference }) => {
      router.route(
        defineRoute({
          filters: { branchPrefix: ['main', 'feature/'] },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({
        codecommit: { references: [codeCommitReference({ ref: 'refs/heads/feature/new-thing' })] },
      });
      // @ts-expect-error - testing private method directly
      const route = router.routes[0];
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(route, record);

      expect(result).toBeDefined();
    });

    test('does not match route when branchPrefix does not match', ({ codeCommitRecord, codeCommitReference }) => {
      router.route(
        defineRoute({
          filters: { branchPrefix: 'feature/' },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({
        codecommit: { references: [codeCommitReference({ ref: 'refs/heads/bugfix/thing' })] },
      });
      // @ts-expect-error - testing private method directly
      const route = router.routes[0];
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(route, record);

      expect(result).toBeUndefined();
    });

    test('matches route by branchSuffix', ({ codeCommitRecord, codeCommitReference }) => {
      router.route(
        defineRoute({
          filters: { branchSuffix: '-release' },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({
        codecommit: { references: [codeCommitReference({ ref: 'refs/heads/v2-release' })] },
      });
      // @ts-expect-error - testing private method directly
      const route = router.routes[0];
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(route, record);

      expect(result).toBeDefined();
    });

    test('matches route by branchSuffix array', ({ codeCommitRecord, codeCommitReference }) => {
      router.route(
        defineRoute({
          filters: { branchSuffix: ['-release', '-hotfix'] },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({
        codecommit: { references: [codeCommitReference({ ref: 'refs/heads/v2-release' })] },
      });
      // @ts-expect-error - testing private method directly
      const route = router.routes[0];
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(route, record);

      expect(result).toBeDefined();
    });

    test('does not match route when branchSuffix does not match', ({ codeCommitRecord, codeCommitReference }) => {
      router.route(
        defineRoute({
          filters: { branchSuffix: '-release' },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({
        codecommit: { references: [codeCommitReference({ ref: 'refs/heads/main' })] },
      });
      // @ts-expect-error - testing private method directly
      const route = router.routes[0];
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(route, record);

      expect(result).toBeUndefined();
    });

    test('matches route by branchIncludes', ({ codeCommitRecord, codeCommitReference }) => {
      router.route(
        defineRoute({
          filters: { branchIncludes: 'deploy' },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({
        codecommit: { references: [codeCommitReference({ ref: 'refs/heads/auto-deploy-prod' })] },
      });
      // @ts-expect-error - testing private method directly
      const route = router.routes[0];
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(route, record);

      expect(result).toBeDefined();
    });

    test('matches route by branchIncludes array', ({ codeCommitRecord, codeCommitReference }) => {
      router.route(
        defineRoute({
          filters: { branchIncludes: ['deploy', 'hotfix'] },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({
        codecommit: { references: [codeCommitReference({ ref: 'refs/heads/auto-deploy-prod' })] },
      });
      // @ts-expect-error - testing private method directly
      const route = router.routes[0];
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(route, record);

      expect(result).toBeDefined();
    });

    test('does not match route when branchIncludes does not match', ({ codeCommitRecord, codeCommitReference }) => {
      router.route(
        defineRoute({
          filters: { branchIncludes: 'deploy' },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({
        codecommit: { references: [codeCommitReference({ ref: 'refs/heads/feature/thing' })] },
      });
      // @ts-expect-error - testing private method directly
      const route = router.routes[0];
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(route, record);

      expect(result).toBeUndefined();
    });

    test('matches route by customFilter', ({ codeCommitRecord }) => {
      router.route(
        defineRoute({
          filters: {
            customFilter: ({ userIdentityARN }: CodeCommitFilterInput): boolean => {
              return userIdentityARN.includes('test-user');
            },
          },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({ userIdentityARN: 'arn:aws:iam::123456789012:user/test-user' });
      // @ts-expect-error - testing private method directly
      const route = router.routes[0];
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(route, record);

      expect(result).toBeDefined();
    });

    test('does not match route when customFilter returns false', ({ codeCommitRecord }) => {
      router.route(
        defineRoute({
          filters: { customFilter: (): boolean => false },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord();
      // @ts-expect-error - testing private method directly
      const route = router.routes[0];
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(route, record);

      expect(result).toBeUndefined();
    });

    test('customFilter receives correct arguments', ({ codeCommitRecord, codeCommitReference }) => {
      const customFilter = vi.fn().mockReturnValue(true);
      router.route(
        defineRoute({
          filters: { customFilter },
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
      const route = router.routes[0];
      // @ts-expect-error - testing private method directly
      router.matchRoute(route, record);

      expect(customFilter).toHaveBeenCalledWith({
        references: [reference],
        userIdentityARN: 'arn:aws:iam::123456789012:user/deploy-bot',
        eventSourceARN: 'arn:aws:codecommit:us-east-1:123456789012:my-repo',
        eventTriggerName: 'my-trigger',
      });
    });

    test('matches route with empty filters as a catch-all', ({ codeCommitRecord }) => {
      router.route(
        defineRoute({
          filters: {},
        }).handle(async () => {}),
      );

      const record = codeCommitRecord();
      // @ts-expect-error - testing private method directly
      const route = router.routes[0];
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(route, record);

      expect(result).toBeDefined();
    });

    test('referenceFilter push filters references before branch matching', ({
      codeCommitRecord,
      codeCommitReference,
    }) => {
      router.push(
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
      const route = router.routes[0];
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(route, record);

      expect(result).toBeDefined();
      expect(result?.references).toEqual([pushRef]);
    });

    test('returns undefined when referenceFilter yields no matching references', ({
      codeCommitRecord,
      codeCommitReference,
    }) => {
      router.push(
        defineRoute({
          filters: {},
        }).handle(async () => {}),
      );

      const createdRef = codeCommitReference({ ref: 'refs/heads/main', created: true });
      const record = codeCommitRecord({
        codecommit: { references: [createdRef] },
      });
      // @ts-expect-error - testing private method directly
      const route = router.routes[0];
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(route, record);

      expect(result).toBeUndefined();
    });

    test('customFilter receives filtered references when referenceFilter is set', ({
      codeCommitRecord,
      codeCommitReference,
    }) => {
      const customFilter = vi.fn().mockReturnValue(true);
      router.push(
        defineRoute({
          filters: { customFilter },
        }).handle(async () => {}),
      );

      const pushRef = codeCommitReference({ ref: 'refs/heads/main' });
      const createdRef = codeCommitReference({ ref: 'refs/heads/main', created: true });
      const record = codeCommitRecord({
        codecommit: { references: [pushRef, createdRef] },
      });
      // @ts-expect-error - testing private method directly
      const route = router.routes[0];
      // @ts-expect-error - testing private method directly
      router.matchRoute(route, record);

      expect(customFilter).toHaveBeenCalledWith(
        expect.objectContaining({
          references: [pushRef],
        }),
      );
    });

    test('customFilter is not called when an earlier filter fails', ({ codeCommitRecord }) => {
      const customFilter = vi.fn().mockReturnValue(true);
      router.route(
        defineRoute({
          filters: {
            eventSourceArn: 'arn:aws:codecommit:us-east-1:123456789012:other-repo',
            customFilter,
          },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({ eventSourceARN: 'arn:aws:codecommit:us-east-1:123456789012:my-repo' });
      // @ts-expect-error - testing private method directly
      const route = router.routes[0];
      // @ts-expect-error - testing private method directly
      router.matchRoute(route, record);

      expect(customFilter).not.toHaveBeenCalled();
    });

    test('matches when both eventSourceArns and branches match', ({ codeCommitRecord, codeCommitReference }) => {
      const eventSourceArn = 'arn:aws:codecommit:us-east-1:123456789012:my-repo';
      router.route(
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
      const route = router.routes[0];
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(route, record);

      expect(result).toBeDefined();
    });

    test('does not match when eventSourceArns matches but branches does not', ({
      codeCommitRecord,
      codeCommitReference,
    }) => {
      const eventSourceArn = 'arn:aws:codecommit:us-east-1:123456789012:my-repo';
      router.route(
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
      const route = router.routes[0];
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(route, record);

      expect(result).toBeUndefined();
    });

    test('extracts branch name from refs/heads/ prefix for branch filters', ({
      codeCommitRecord,
      codeCommitReference,
    }) => {
      router.route(
        defineRoute({
          filters: { branch: 'feature/deep/nested' },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({
        codecommit: { references: [codeCommitReference({ ref: 'refs/heads/feature/deep/nested' })] },
      });
      // @ts-expect-error - testing private method directly
      const route = router.routes[0];
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(route, record);

      expect(result).toBeDefined();
    });
  });

  suite('matchRoutes', () => {
    test('returns all matching routes, not just the first', ({ codeCommitRecord }) => {
      const handlerA = vi.fn();
      const handlerB = vi.fn();
      router.route(defineRoute({ filters: {} }).handle(handlerA));
      router.route(defineRoute({ filters: {} }).handle(handlerB));

      const record = codeCommitRecord();
      // @ts-expect-error - testing private method directly
      const results = router.matchRoutes(record);

      expect(results).toHaveLength(2);
    });

    test('multiple routes match same record with different reference subsets', ({
      codeCommitRecord,
      codeCommitReference,
    }) => {
      router.push(defineRoute({ filters: {} }).handle(async () => {}));
      router.branchCreated(defineRoute({ filters: {} }).handle(async () => {}));

      const pushRef = codeCommitReference({ ref: 'refs/heads/main' });
      const createdRef = codeCommitReference({ ref: 'refs/heads/feature', created: true });
      const record = codeCommitRecord({
        codecommit: { references: [pushRef, createdRef] },
      });
      // @ts-expect-error - testing private method directly
      const results = router.matchRoutes(record);

      expect(results).toHaveLength(2);
      // @ts-expect-error - results[0] is asserted by length check above
      expect(results[0].references).toEqual([pushRef]);
      // @ts-expect-error - results[1] is asserted by length check above
      expect(results[1].references).toEqual([createdRef]);
    });

    test('non-matching routes are skipped', ({ codeCommitRecord }) => {
      const handlerA = vi.fn();
      const handlerB = vi.fn();
      router.route(
        defineRoute({
          filters: { eventSourceArn: 'arn:aws:codecommit:us-east-1:123456789012:other-repo' },
        }).handle(handlerA),
      );
      router.route(defineRoute({ filters: {} }).handle(handlerB));

      const record = codeCommitRecord({ eventSourceARN: 'arn:aws:codecommit:us-east-1:123456789012:my-repo' });
      // @ts-expect-error - testing private method directly
      const results = router.matchRoutes(record);

      expect(results).toHaveLength(1);
      // @ts-expect-error - results[0] is asserted by length check above
      expect(results[0].route.handler).toBe(handlerB);
    });

    test('returns empty array when no routes match', ({ codeCommitRecord }) => {
      router.route(
        defineRoute({
          filters: { eventSourceArn: 'arn:aws:codecommit:us-east-1:123456789012:other-repo' },
        }).handle(async () => {}),
      );

      const record = codeCommitRecord({ eventSourceARN: 'arn:aws:codecommit:us-east-1:123456789012:my-repo' });
      // @ts-expect-error - testing private method directly
      const results = router.matchRoutes(record);

      expect(results).toHaveLength(0);
    });
  });

  suite('processRecord', () => {
    test('throws when no route matches', async ({ codeCommitRecord, context }) => {
      const record = codeCommitRecord();

      // @ts-expect-error - testing private method directly
      await expect(router.processRecord(record, context())).rejects.toThrow(
        `No route matched for CodeCommit record ${record.eventId}`,
      );
    });

    test('passes correct CodeCommitRequest shape to handler', async ({
      codeCommitRecord,
      codeCommitReference,
      context,
    }) => {
      const handler = vi.fn();
      router.route(defineRoute({ filters: {} }).handle(handler));

      const reference = codeCommitReference({ ref: 'refs/heads/main' });
      const mockContext = context();
      const record = codeCommitRecord({
        codecommit: { references: [reference] },
        userIdentityARN: 'arn:aws:iam::123456789012:user/test-user',
        eventTriggerName: 'my-trigger',
        eventSourceARN: 'arn:aws:codecommit:us-east-1:123456789012:my-repo',
      });

      // @ts-expect-error - testing private method directly
      await router.processRecord(record, mockContext);

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

      router.push(defineRoute({ filters: {} }).handle(handler));

      const pushRef = codeCommitReference({ ref: 'refs/heads/main' });
      const createdRef = codeCommitReference({ ref: 'refs/heads/feature', created: true });
      const record = codeCommitRecord({
        codecommit: { references: [pushRef, createdRef] },
      });
      // @ts-expect-error - testing private method directly
      await router.processRecord(record, context());

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
        await new Promise((resolve) => setTimeout(resolve, 10));
        callOrder.push('end-A');
      });
      const handlerB = vi.fn(async () => {
        callOrder.push('start-B');
        await new Promise((resolve) => setTimeout(resolve, 10));
        callOrder.push('end-B');
      });

      router.route(defineRoute({ filters: {} }).handle(handlerA));
      router.route(defineRoute({ filters: {} }).handle(handlerB));

      const record = codeCommitRecord();
      // @ts-expect-error - testing private method directly
      await router.processRecord(record, context());

      // Parallel: both start before either finishes
      expect(callOrder[0]).toBe('start-A');
      expect(callOrder[1]).toBe('start-B');
    });

    test('propagates handler error', async ({ codeCommitRecord, context }) => {
      router.route(
        defineRoute({ filters: {} }).handle(async () => {
          throw new Error('handler exploded');
        }),
      );

      const record = codeCommitRecord();
      // @ts-expect-error - testing private method directly
      await expect(router.processRecord(record, context())).rejects.toThrow('handler exploded');
    });

    test('calls all matched handlers even when they handle different reference subsets', async ({
      codeCommitRecord,
      codeCommitReference,
      context,
    }) => {
      const pushHandler = vi.fn();
      const createHandler = vi.fn();
      router.push(defineRoute({ filters: {} }).handle(pushHandler));
      router.branchCreated(defineRoute({ filters: {} }).handle(createHandler));

      const pushRef = codeCommitReference({ ref: 'refs/heads/main' });
      const createdRef = codeCommitReference({ ref: 'refs/heads/feature', created: true });
      const record = codeCommitRecord({
        codecommit: { references: [pushRef, createdRef] },
      });
      // @ts-expect-error - testing private method directly
      await router.processRecord(record, context());

      expect(pushHandler).toHaveBeenCalledTimes(1);
      expect(createHandler).toHaveBeenCalledTimes(1);
      expect(pushHandler).toHaveBeenCalledWith(expect.objectContaining({ references: [pushRef] }));
      expect(createHandler).toHaveBeenCalledWith(expect.objectContaining({ references: [createdRef] }));
    });
  });

  suite('handleEvent', () => {
    test('returns undefined on success', async ({ codeCommitHandlerEvent }) => {
      router.route(defineRoute({ filters: {} }).handle(async () => {}));

      const { event, context } = codeCommitHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toBeUndefined();
    });

    test('throws when no route matches', async ({ codeCommitHandlerEvent }) => {
      const { event, context } = codeCommitHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('No route matched');
    });

    test('propagates handler errors', async ({ codeCommitHandlerEvent }) => {
      router.route(
        defineRoute({ filters: {} }).handle(async () => {
          throw new Error('handler exploded');
        }),
      );

      const { event, context } = codeCommitHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('handler exploded');
    });

    test('processes multiple records in parallel', async ({ codeCommitRecord, codeCommitEvent, context }) => {
      const callOrder: string[] = [];

      router.route(
        defineRoute({ filters: {} }).handle(async (request) => {
          const eventId = request.record.eventId;
          callOrder.push(`start-${eventId}`);
          await new Promise((resolve) => setTimeout(resolve, 10));
          callOrder.push(`end-${eventId}`);
        }),
      );

      const recordA = codeCommitRecord();
      const recordB = codeCommitRecord();
      const event = codeCommitEvent([recordA, recordB]);
      await router.handleEvent(event, context());

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
      router.route(
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
      await router.handleEvent(event, mockContext);

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

      router.push(defineRoute({ filters: {} }).handle(pushHandler));
      router.branchCreated(defineRoute({ filters: {} }).handle(createHandler));

      const pushRef = codeCommitReference({ ref: 'refs/heads/main' });
      const createdRef = codeCommitReference({ ref: 'refs/heads/feature', created: true });
      const record = codeCommitRecord({
        codecommit: { references: [pushRef, createdRef] },
      });
      const event = codeCommitEvent([record]);
      await router.handleEvent(event, context());

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
      router.route(
        defineRoute({
          filters: { repositoryName: 'repo-a' },
        }).handle(repoAHandler),
      );
      router.route(
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
      await router.handleEvent(event, context());

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
      router.push(defineRoute({ filters: {} }).handle(pushHandler));
      router.branchCreated(defineRoute({ filters: {} }).handle(createHandler));
      router.branchDeleted(defineRoute({ filters: {} }).handle(deleteHandler));

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
      await router.handleEvent(event, context());

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
      router.push(defineRoute({ filters: {} }).handle(pushHandler));
      router.branchCreated(defineRoute({ filters: {} }).handle(createHandler));
      router.branchDeleted(defineRoute({ filters: {} }).handle(deleteHandler));

      const pushRef = codeCommitReference({ ref: 'refs/heads/main' });
      const createdRef = codeCommitReference({ ref: 'refs/heads/feature', created: true });
      const deletedRef = codeCommitReference({ ref: 'refs/heads/old-branch', deleted: true });

      const record = codeCommitRecord({
        codecommit: { references: [pushRef, createdRef, deletedRef] },
      });
      const event = codeCommitEvent([record]);
      await router.handleEvent(event, context());

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
      router.push(defineRoute({ filters: { branch: 'main' } }).handle(mainHandler));
      router.route(defineRoute({ filters: {} }).handle(catchAllHandler));

      const mainRef = codeCommitReference({ ref: 'refs/heads/main' });
      const featureRef = codeCommitReference({ ref: 'refs/heads/feature' });

      const mainRecord = codeCommitRecord({
        codecommit: { references: [mainRef] },
      });
      const featureRecord = codeCommitRecord({
        codecommit: { references: [featureRef] },
      });

      const event = codeCommitEvent([mainRecord, featureRecord]);
      await router.handleEvent(event, context());

      // main record matches both push (main branch) and catch-all
      expect(mainHandler).toHaveBeenCalledTimes(1);
      // catch-all matches both records
      expect(catchAllHandler).toHaveBeenCalledTimes(2);
    });
  });

  suite('router-level middleware', () => {
    test('executes middleware before the route handler', async ({ codeCommitHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middleware(request: CodeCommitRequest, next: CodeCommitNext): Promise<void> {
        callOrder.push('mw-pre');
        await next(request);
        callOrder.push('mw-post');
      }

      const router = createCodeCommitRouter({ middleware: [middleware] });
      router.route(
        defineRoute({ filters: {} }).handle(async () => {
          callOrder.push('handler');
        }),
      );

      const { event, context } = codeCommitHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
    });

    test('allows middleware to skip a record by not calling next', async ({ codeCommitHandlerEvent }) => {
      const handler = vi.fn();

      async function skipMiddleware(_request: CodeCommitRequest, _next: CodeCommitNext): Promise<void> {
        return;
      }

      const router = createCodeCommitRouter({ middleware: [skipMiddleware] });
      router.route(defineRoute({ filters: {} }).handle(handler));

      const { event, context } = codeCommitHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple router-level middleware in order', async ({ codeCommitHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middlewareOne(request: CodeCommitRequest, next: CodeCommitNext): Promise<void> {
        callOrder.push('mw1');
        await next(request);
      }

      async function middlewareTwo(request: CodeCommitRequest, next: CodeCommitNext): Promise<void> {
        callOrder.push('mw2');
        await next(request);
      }

      const router = createCodeCommitRouter({ middleware: [middlewareOne, middlewareTwo] });
      router.route(
        defineRoute({ filters: {} }).handle(async () => {
          callOrder.push('handler');
        }),
      );

      const { event, context } = codeCommitHandlerEvent();
      await router.handleEvent(event, context);

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

      const router = createCodeCommitRouter({ middleware: [middleware] });
      router.push(
        defineRoute({ filters: {} }).handle(async () => {
          callOrder.push('push-handler');
        }),
      );
      router.branchCreated(
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
      await router.handleEvent(event, context());

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

      router.route(
        defineRoute({ filters: {}, middleware: [routeMiddleware] }).handle(async () => {
          callOrder.push('handler');
        }),
      );

      const { event, context } = codeCommitHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });

    test('allows route-level middleware to short-circuit by not calling next', async ({ codeCommitHandlerEvent }) => {
      const handler = vi.fn();

      async function blockingRouteMiddleware(_request: CodeCommitRequest, _next: CodeCommitNext): Promise<void> {
        return;
      }
      router.route(defineRoute({ filters: {}, middleware: [blockingRouteMiddleware] }).handle(handler));

      const { event, context } = codeCommitHandlerEvent();
      await router.handleEvent(event, context);

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
      router.route(
        defineRoute({ filters: {}, middleware: [routeMiddlewareOne, routeMiddlewareTwo] }).handle(async () => {
          callOrder.push('handler');
        }),
      );

      const { event, context } = codeCommitHandlerEvent();
      await router.handleEvent(event, context);

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
      router.route(route);

      const { event, context } = codeCommitHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });
  });

  suite('combined router and route middleware', () => {
    test('executes router middleware before route middleware', async ({ codeCommitHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routerMiddleware(request: CodeCommitRequest, next: CodeCommitNext): Promise<void> {
        callOrder.push('router-mw');
        await next(request);
      }

      async function routeMiddleware(request: CodeCommitRequest, next: CodeCommitNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      const router = createCodeCommitRouter({ middleware: [routerMiddleware] });
      router.route(
        defineRoute({ filters: {}, middleware: [routeMiddleware] }).handle(async () => {
          callOrder.push('handler');
        }),
      );

      const { event, context } = codeCommitHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['router-mw', 'route-mw', 'handler']);
    });

    test('router middleware short-circuit prevents route middleware from running', async ({
      codeCommitHandlerEvent,
    }) => {
      const routeMiddleware = vi.fn();
      const handler = vi.fn();

      async function blockingRouterMiddleware(_request: CodeCommitRequest, _next: CodeCommitNext): Promise<void> {
        return;
      }

      const router = createCodeCommitRouter({ middleware: [blockingRouterMiddleware] });
      router.route(defineRoute({ filters: {}, middleware: [routeMiddleware] }).handle(handler));

      const { event, context } = codeCommitHandlerEvent();
      await router.handleEvent(event, context);

      expect(routeMiddleware).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
