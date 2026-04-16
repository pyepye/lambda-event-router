import { createSESEvent, test } from '@lambda-event-router/testing';
import { createSESRouter, defineRoute, SESRouter } from './SESRouter.js';
import type { SESRequest } from './types.js';

type SESNext = (request: SESRequest) => Promise<void>;

suite('SESRouter', () => {
  let router: SESRouter;

  beforeEach(() => {
    router = new SESRouter();
  });

  suite('createSESRouter', () => {
    test('creates an SESRouter instance', () => {
      const router = createSESRouter();
      expect(router).toBeInstanceOf(SESRouter);
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for a valid SES event', () => {
      const event = createSESEvent();
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns false for a non-SES event object', () => {
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

    test('returns false when eventSource is not aws:ses', () => {
      expect(router.canHandleEvent({ Records: [{ eventSource: 'aws:sqs' }] })).toBe(false);
    });
  });

  suite('defineRoute', () => {
    test('returns a route builder with a handle method', () => {
      const builder = defineRoute({
        filters: { recipient: 'user@example.com' },
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });

    test('preserves filters and handler in the definition', () => {
      const handler = vi.fn();
      const filters = {
        recipient: 'user@example.com',
        sender: 'sender@example.com',
      };

      const definition = defineRoute({ filters }).handle(handler);

      expect(definition).toEqual({ filters, handler });
    });
  });

  suite('route', () => {
    test('returns the router instance for chaining', () => {
      const definition = defineRoute({
        filters: { recipient: 'user@example.com' },
      }).handle(async () => {});

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  suite('matchRoute', () => {
    test('matches route by recipient', ({ sesRecord }) => {
      router.route(
        defineRoute({
          filters: { recipient: 'recipient@example.com' },
        }).handle(async () => {}),
      );

      const record = sesRecord({ ses: { receipt: { recipients: ['recipient@example.com'] } } });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record);

      expect(result).toBeDefined();
    });

    test('matches route by recipient array', ({ sesRecord }) => {
      router.route(
        defineRoute({
          filters: { recipient: ['recipient@example.com', 'other@example.com'] },
        }).handle(async () => {}),
      );

      const record = sesRecord({ ses: { receipt: { recipients: ['recipient@example.com'] } } });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record);

      expect(result).toBeDefined();
    });

    test('does not match route when recipient do not match', ({ sesRecord }) => {
      router.route(
        defineRoute({
          filters: { recipient: 'other@example.com' },
        }).handle(async () => {}),
      );

      const record = sesRecord({ ses: { receipt: { recipients: ['user@example.com'] } } });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record);

      expect(result).toBeUndefined();
    });

    test('matches when one of multiple recipient matches', ({ sesRecord }) => {
      router.route(
        defineRoute({
          filters: { recipient: 'recipient@example.com' },
        }).handle(async () => {}),
      );

      const record = sesRecord({
        ses: { receipt: { recipients: ['nobody@example.com', 'recipient@example.com'] } },
      });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record);

      expect(result).toBeDefined();
    });

    test('matches route by sender', ({ sesRecord }) => {
      router.route(
        defineRoute({
          filters: { sender: 'sender@example.com' },
        }).handle(async () => {}),
      );

      const record = sesRecord({ ses: { mail: { source: 'sender@example.com' } } });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record);

      expect(result).toBeDefined();
    });

    test('matches route by sender array', ({ sesRecord }) => {
      router.route(
        defineRoute({
          filters: { sender: ['sender@example.com', 'other@example.com'] },
        }).handle(async () => {}),
      );

      const record = sesRecord({ ses: { mail: { source: 'sender@example.com' } } });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record);

      expect(result).toBeDefined();
    });

    test('does not match route when senders do not match', ({ sesRecord }) => {
      router.route(
        defineRoute({
          filters: { sender: 'other@example.com' },
        }).handle(async () => {}),
      );

      const record = sesRecord({ ses: { mail: { source: 'user@example.com' } } });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record);

      expect(result).toBeUndefined();
    });

    test('matches route by senderDomain', ({ sesRecord }) => {
      router.route(
        defineRoute({
          filters: { senderDomain: 'example.com' },
        }).handle(async () => {}),
      );

      const record = sesRecord({ ses: { mail: { source: 'user@example.com' } } });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record);

      expect(result).toBeDefined();
    });

    test('matches route by senderDomain array', ({ sesRecord }) => {
      router.route(
        defineRoute({
          filters: { senderDomain: ['example.com', 'test.com'] },
        }).handle(async () => {}),
      );

      const record = sesRecord({ ses: { mail: { source: 'user@example.com' } } });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record);

      expect(result).toBeDefined();
    });

    test('does not match route when senderDomain do not match', ({ sesRecord }) => {
      router.route(
        defineRoute({
          filters: { senderDomain: 'other.com' },
        }).handle(async () => {}),
      );

      const record = sesRecord({ ses: { mail: { source: 'user@example.com' } } });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record);

      expect(result).toBeUndefined();
    });

    test('matches route by recipientDomain', ({ sesRecord }) => {
      router.route(
        defineRoute({
          filters: { recipientDomain: 'example.com' },
        }).handle(async () => {}),
      );

      const record = sesRecord({ ses: { receipt: { recipients: ['user@example.com'] } } });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record);

      expect(result).toBeDefined();
    });

    test('matches route by recipientDomain array', ({ sesRecord }) => {
      router.route(
        defineRoute({
          filters: { recipientDomain: ['example.com', 'test.com'] },
        }).handle(async () => {}),
      );

      const record = sesRecord({ ses: { receipt: { recipients: ['user@example.com'] } } });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record);

      expect(result).toBeDefined();
    });

    test('does not match route when recipientDomain do not match', ({ sesRecord }) => {
      router.route(
        defineRoute({
          filters: { recipientDomain: 'other.com' },
        }).handle(async () => {}),
      );

      const record = sesRecord({ ses: { receipt: { recipients: ['user@example.com'] } } });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record);

      expect(result).toBeUndefined();
    });

    test('matches when one of multiple recipient domains matches', ({ sesRecord }) => {
      router.route(
        defineRoute({
          filters: { recipientDomain: 'example.com' },
        }).handle(async () => {}),
      );

      const record = sesRecord({
        ses: { receipt: { recipients: ['nobody@other.com', 'recipient@example.com'] } },
      });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record);

      expect(result).toBeDefined();
    });

    const verdictTypes = ['spamVerdict', 'virusVerdict', 'spfVerdict', 'dkimVerdict', 'dmarcVerdict'] as const;

    for (const verdictType of verdictTypes) {
      test(`matches route by ${verdictType}`, ({ sesRecord }) => {
        router.route(
          defineRoute({
            filters: { [verdictType]: 'PASS' },
          }).handle(async () => {}),
        );

        const record = sesRecord({ ses: { receipt: { [verdictType]: { status: 'PASS' } } } });
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(record);

        expect(result).toBeDefined();
      });

      test(`matches route by ${verdictType} array`, ({ sesRecord }) => {
        router.route(
          defineRoute({
            filters: { [verdictType]: ['PASS', 'DISABLED'] },
          }).handle(async () => {}),
        );

        const record = sesRecord({ ses: { receipt: { [verdictType]: { status: 'PASS' } } } });
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(record);

        expect(result).toBeDefined();
      });

      test(`does not match route when ${verdictType} does not match`, ({ sesRecord }) => {
        router.route(
          defineRoute({
            filters: { [verdictType]: 'FAIL' },
          }).handle(async () => {}),
        );

        const record = sesRecord({ ses: { receipt: { [verdictType]: { status: 'PASS' } } } });
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(record);

        expect(result).toBeUndefined();
      });
    }

    test('matches verdict with multiple allowed values', ({ sesRecord }) => {
      router.route(
        defineRoute({
          filters: { spamVerdict: ['PASS', 'GRAY'] },
        }).handle(async () => {}),
      );

      const record = sesRecord({ ses: { receipt: { spamVerdict: { status: 'GRAY' } } } });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record);

      expect(result).toBeDefined();
    });

    test('matches route by customFilter returning true', ({ sesRecord }) => {
      router.route(
        defineRoute({
          filters: {
            customFilter: (): boolean => true,
          },
        }).handle(async () => {}),
      );

      const record = sesRecord();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record);

      expect(result).toBeDefined();
    });

    test('does not match route when customFilter returns false', ({ sesRecord }) => {
      router.route(
        defineRoute({
          filters: {
            customFilter: (): boolean => false,
          },
        }).handle(async () => {}),
      );

      const record = sesRecord();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record);

      expect(result).toBeUndefined();
    });

    test('customFilter receives receipt and mail', ({ sesRecord }) => {
      const filterSpy = vi.fn((): boolean => true);
      router.route(
        defineRoute({
          filters: { customFilter: filterSpy },
        }).handle(async () => {}),
      );

      const record = sesRecord();
      // @ts-expect-error - testing private method directly
      router.matchRoute(record);

      expect(filterSpy).toHaveBeenCalledWith({
        receipt: record.ses.receipt,
        mail: record.ses.mail,
      });
    });

    test('customFilter is not evaluated when an earlier filter fails', ({ sesRecord }) => {
      const filterSpy = vi.fn((): boolean => true);
      router.route(
        defineRoute({
          filters: {
            recipient: 'nonexistent@example.com',
            customFilter: filterSpy,
          },
        }).handle(async () => {}),
      );

      const record = sesRecord({ ses: { receipt: { recipients: ['user@example.com'] } } });
      // @ts-expect-error - testing private method directly
      router.matchRoute(record);

      expect(filterSpy).not.toHaveBeenCalled();
    });

    test('matches route with empty filters as a catch-all', ({ sesRecord }) => {
      router.route(
        defineRoute({
          filters: {},
        }).handle(async () => {}),
      );

      const record = sesRecord();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record);

      expect(result).toBeDefined();
    });

    test('selects the first matching route when multiple routes match', ({ sesRecord }) => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();

      router.route(
        defineRoute({
          filters: { recipient: 'recipient@example.com' },
        }).handle(firstHandler),
      );
      router.route(
        defineRoute({
          filters: { recipient: 'recipient@example.com' },
        }).handle(secondHandler),
      );

      const record = sesRecord({ ses: { receipt: { recipients: ['recipient@example.com'] } } });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record);

      expect(result).toBeDefined();
      expect(result?.handler).toBe(firstHandler);
    });

    test('matches when both recipients and senders match', ({ sesRecord }) => {
      router.route(
        defineRoute({
          filters: {
            recipient: 'recipient@example.com',
            sender: 'sender@example.com',
          },
        }).handle(async () => {}),
      );

      const record = sesRecord({
        ses: {
          receipt: { recipients: ['recipient@example.com'] },
          mail: { source: 'sender@example.com' },
        },
      });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record);

      expect(result).toBeDefined();
    });

    test('does not match when recipients match but senders do not', ({ sesRecord }) => {
      router.route(
        defineRoute({
          filters: {
            recipient: 'recipient@example.com',
            sender: 'other@example.com',
          },
        }).handle(async () => {}),
      );

      const record = sesRecord({
        ses: {
          receipt: { recipients: ['recipient@example.com'] },
          mail: { source: 'sender@example.com' },
        },
      });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record);

      expect(result).toBeUndefined();
    });

    test('does not match when senders match but recipients do not', ({ sesRecord }) => {
      router.route(
        defineRoute({
          filters: {
            recipient: 'other@example.com',
            sender: 'sender@example.com',
          },
        }).handle(async () => {}),
      );

      const record = sesRecord({
        ses: {
          receipt: { recipients: ['user@example.com'] },
          mail: { source: 'sender@example.com' },
        },
      });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record);

      expect(result).toBeUndefined();
    });

    test('matches when both senderDomain and recipientDomain match', ({ sesRecord }) => {
      router.route(
        defineRoute({
          filters: {
            senderDomain: 'example.com',
            recipientDomain: 'example.com',
          },
        }).handle(async () => {}),
      );

      const record = sesRecord({
        ses: {
          mail: { source: 'user@example.com' },
          receipt: { recipients: ['user@example.com'] },
        },
      });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record);

      expect(result).toBeDefined();
    });

    test('does not match when senderDomain match but recipientDomain do not', ({ sesRecord }) => {
      router.route(
        defineRoute({
          filters: {
            senderDomain: 'example.com',
            recipientDomain: 'other.com',
          },
        }).handle(async () => {}),
      );

      const record = sesRecord({
        ses: {
          mail: { source: 'user@example.com' },
          receipt: { recipients: ['user@example.com'] },
        },
      });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record);

      expect(result).toBeUndefined();
    });

    test('matches when recipients, spamVerdict, and virusVerdict all match', ({ sesRecord }) => {
      router.route(
        defineRoute({
          filters: {
            recipient: 'recipient@example.com',
            spamVerdict: 'PASS',
            virusVerdict: 'PASS',
          },
        }).handle(async () => {}),
      );

      const record = sesRecord({
        ses: {
          receipt: {
            recipients: ['recipient@example.com'],
            spamVerdict: { status: 'PASS' },
            virusVerdict: { status: 'PASS' },
          },
        },
      });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(record);

      expect(result).toBeDefined();
    });
  });

  suite('buildRequest', () => {
    test('builds request with all expected properties', ({ sesRecord, context }) => {
      const record = sesRecord();
      const { mail, receipt } = record.ses;
      const mockContext = context();

      // @ts-expect-error - testing private method directly
      const request = router.buildRequest(record, mail, receipt, mockContext);

      expect(request).toEqual({
        source: mail.source,
        subject: mail.commonHeaders.subject,
        recipients: receipt.recipients,
        receipt,
        mail,
        record,
        context: mockContext,
      });
    });

    test('sets subject to undefined when commonHeaders.subject is undefined', ({ sesRecord, context }) => {
      const record = sesRecord({ ses: { mail: { commonHeaders: { subject: undefined } } } });
      const { mail, receipt } = record.ses;
      const mockContext = context();

      // @ts-expect-error - testing private method directly
      const request = router.buildRequest(record, mail, receipt, mockContext);

      expect(request.subject).toBeUndefined();
    });
  });

  suite('handleEvent', () => {
    test('calls matched handler with correct SESRequest shape', async ({ sesRecord, sesHandlerEvent }) => {
      const handler = vi.fn();
      router.route(
        defineRoute({
          filters: { recipient: 'recipient@example.com' },
        }).handle(handler),
      );

      const record = sesRecord({ ses: { receipt: { recipients: ['recipient@example.com'] } } });
      const { event, context } = sesHandlerEvent({ records: [record] });
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          source: record.ses.mail.source,
          subject: record.ses.mail.commonHeaders.subject,
          recipients: record.ses.receipt.recipients,
          receipt: record.ses.receipt,
          mail: record.ses.mail,
          record: event.Records[0],
          context,
        }),
      );
    });

    test('returns undefined', async ({ sesHandlerEvent }) => {
      router.route(
        defineRoute({
          filters: {},
        }).handle(async () => {}),
      );

      const { event, context } = sesHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toBeUndefined();
    });

    test('throws when no route matches', async ({ sesHandlerEvent }) => {
      const { event, context } = sesHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('No route matched');
    });

    test('throws with messageId in error message', async ({ sesRecord, sesHandlerEvent }) => {
      const record = sesRecord();

      const { event, context } = sesHandlerEvent({ records: [record] });
      await expect(router.handleEvent(event, context)).rejects.toThrow(record.ses.mail.messageId);
    });

    test('propagates handler error', async ({ sesHandlerEvent }) => {
      router.route(
        defineRoute({
          filters: {},
        }).handle(async () => {
          throw new Error('handler exploded');
        }),
      );

      const { event, context } = sesHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('handler exploded');
    });

    test('processes records in parallel', async ({ sesRecord, sesEvent, context }) => {
      const callOrder: string[] = [];

      router.route(
        defineRoute({
          filters: {},
        }).handle(async (request) => {
          const messageId = request.record.ses.mail.messageId;
          callOrder.push(`start-${messageId}`);
          await new Promise((resolve) => setTimeout(resolve, 10));
          callOrder.push(`end-${messageId}`);
        }),
      );

      const recordA = sesRecord();
      const recordB = sesRecord();
      const event = sesEvent([recordA, recordB]);
      await router.handleEvent(event, context());

      // Parallel: both start before either finishes
      expect(callOrder[0]).toBe(`start-${recordA.ses.mail.messageId}`);
      expect(callOrder[1]).toBe(`start-${recordB.ses.mail.messageId}`);
    });
  });

  suite('full event processing', () => {
    test('routes records to different handlers based on filter combinations', async ({
      sesRecord,
      sesEvent,
      context,
    }) => {
      const internalHandler = vi.fn();
      const externalHandler = vi.fn();

      router.route(
        defineRoute({
          filters: { senderDomain: 'internal.com' },
        }).handle(internalHandler),
      );
      router.route(
        defineRoute({
          filters: { senderDomain: 'external.com' },
        }).handle(externalHandler),
      );

      const records = [
        sesRecord({ ses: { mail: { source: 'alice@internal.com' } } }),
        sesRecord({ ses: { mail: { source: 'bob@internal.com' } } }),
        sesRecord({ ses: { mail: { source: 'carol@external.com' } } }),
      ];
      const event = sesEvent(records);
      const result = await router.handleEvent(event, context());

      expect(result).toBeUndefined();
      expect(internalHandler).toHaveBeenCalledTimes(2);
      expect(externalHandler).toHaveBeenCalledTimes(1);
    });
  });

  suite('router-level middleware', () => {
    test('executes middleware before the route handler', async ({ sesHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middleware(request: SESRequest, next: SESNext): Promise<void> {
        callOrder.push('mw-pre');
        await next(request);
        callOrder.push('mw-post');
      }

      const router = createSESRouter({ middleware: [middleware] });
      router.route({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = sesHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
    });

    test('allows middleware to skip a record by not calling next', async ({ sesHandlerEvent }) => {
      const handler = vi.fn();

      async function skipMiddleware(_request: SESRequest, _next: SESNext): Promise<void> {
        return;
      }

      const router = createSESRouter({ middleware: [skipMiddleware] });
      router.route({ filters: {}, handler });

      const { event, context } = sesHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple router-level middleware in order', async ({ sesHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middlewareOne(request: SESRequest, next: SESNext): Promise<void> {
        callOrder.push('mw1');
        await next(request);
      }

      async function middlewareTwo(request: SESRequest, next: SESNext): Promise<void> {
        callOrder.push('mw2');
        await next(request);
      }

      const router = createSESRouter({ middleware: [middlewareOne, middlewareTwo] });
      router.route({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = sesHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw1', 'mw2', 'handler']);
    });
  });

  suite('route-level middleware', () => {
    test('executes route-level middleware for a specific route', async ({ sesHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: SESRequest, next: SESNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      router.route({
        filters: {},
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = sesHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });

    test('allows route-level middleware to short-circuit by not calling next', async ({ sesHandlerEvent }) => {
      const handler = vi.fn();

      async function blockingRouteMiddleware(_request: SESRequest, _next: SESNext): Promise<void> {
        return;
      }

      router.route({ filters: {}, middleware: [blockingRouteMiddleware], handler });

      const { event, context } = sesHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple route-level middleware in order', async ({ sesHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddlewareOne(request: SESRequest, next: SESNext): Promise<void> {
        callOrder.push('route-mw1');
        await next(request);
      }

      async function routeMiddlewareTwo(request: SESRequest, next: SESNext): Promise<void> {
        callOrder.push('route-mw2');
        await next(request);
      }

      router.route({
        filters: {},
        middleware: [routeMiddlewareOne, routeMiddlewareTwo],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = sesHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw1', 'route-mw2', 'handler']);
    });

    test('supports middleware on defineRoute builder pattern', async ({ sesHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: SESRequest, next: SESNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      const route = defineRoute({ filters: {}, middleware: [routeMiddleware] }).handle(async () => {
        callOrder.push('handler');
      });

      router.route(route);

      const { event, context } = sesHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });
  });

  suite('combined router and route middleware', () => {
    test('executes router middleware before route middleware', async ({ sesHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routerMiddleware(request: SESRequest, next: SESNext): Promise<void> {
        callOrder.push('router-mw');
        await next(request);
      }

      async function routeMiddleware(request: SESRequest, next: SESNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      const router = createSESRouter({ middleware: [routerMiddleware] });
      router.route({
        filters: {},
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = sesHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['router-mw', 'route-mw', 'handler']);
    });

    test('router middleware short-circuit prevents route middleware from running', async ({ sesHandlerEvent }) => {
      const routeMiddleware = vi.fn();
      const handler = vi.fn();

      async function blockingRouterMiddleware(_request: SESRequest, _next: SESNext): Promise<void> {
        return;
      }

      const router = createSESRouter({ middleware: [blockingRouterMiddleware] });
      router.route({ filters: {}, middleware: [routeMiddleware], handler });

      const { event, context } = sesHandlerEvent();
      await router.handleEvent(event, context);

      expect(routeMiddleware).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
