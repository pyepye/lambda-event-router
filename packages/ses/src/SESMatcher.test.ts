import { allEventBuilders, createSESEvent, test } from '@latcher/testing';

import { createSESMatcher, defineRoute, SESMatcher } from './SESMatcher.js';
import type { SESRequest, SESResponse } from './types.js';

type SESNext = (request: SESRequest) => Promise<SESResponse>;

suite('SESMatcher', () => {
  let matcher: SESMatcher;

  beforeEach(() => {
    matcher = new SESMatcher();
  });

  suite('createSESMatcher', () => {
    test('creates an SESMatcher instance', () => {
      const matcher = createSESMatcher();
      expect(matcher).toBeInstanceOf(SESMatcher);
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for a valid SES event', () => {
      const event = createSESEvent();
      expect(matcher.canHandleEvent(event)).toBe(true);
    });

    test('returns false for a non-SES event object', () => {
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

    test('returns false when eventSource is not aws:ses', () => {
      expect(matcher.canHandleEvent({ Records: [{ eventSource: 'aws:sqs' }] })).toBe(false);
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
    test('returns the matcher instance for chaining', () => {
      const definition = defineRoute({
        filters: { recipient: 'user@example.com' },
      }).handle(async () => {});

      const result = matcher.route(definition);

      expect(result).toBe(matcher);
    });
  });

  suite('matchRoute', () => {
    test('matches route by recipient', async ({ sesRecord }) => {
      matcher.route(
        defineRoute({
          filters: { recipient: 'recipient@example.com' },
        }).handle(async () => {}),
      );

      const record = sesRecord({ ses: { receipt: { recipients: ['recipient@example.com'] } } });
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(record);

      expect(result).toBeDefined();
    });

    test('matches route by recipient array', async ({ sesRecord }) => {
      matcher.route(
        defineRoute({
          filters: { recipient: ['recipient@example.com', 'other@example.com'] },
        }).handle(async () => {}),
      );

      const record = sesRecord({ ses: { receipt: { recipients: ['recipient@example.com'] } } });
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(record);

      expect(result).toBeDefined();
    });

    test('does not match route when recipient do not match', async ({ sesRecord }) => {
      matcher.route(
        defineRoute({
          filters: { recipient: 'other@example.com' },
        }).handle(async () => {}),
      );

      const record = sesRecord({ ses: { receipt: { recipients: ['user@example.com'] } } });
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(record);

      expect(result).toBeUndefined();
    });

    test('matches when one of multiple recipient matches', async ({ sesRecord }) => {
      matcher.route(
        defineRoute({
          filters: { recipient: 'recipient@example.com' },
        }).handle(async () => {}),
      );

      const record = sesRecord({
        ses: { receipt: { recipients: ['nobody@example.com', 'recipient@example.com'] } },
      });
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(record);

      expect(result).toBeDefined();
    });

    test('matches route by sender', async ({ sesRecord }) => {
      matcher.route(
        defineRoute({
          filters: { sender: 'sender@example.com' },
        }).handle(async () => {}),
      );

      const record = sesRecord({ ses: { mail: { source: 'sender@example.com' } } });
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(record);

      expect(result).toBeDefined();
    });

    test('matches route by sender array', async ({ sesRecord }) => {
      matcher.route(
        defineRoute({
          filters: { sender: ['sender@example.com', 'other@example.com'] },
        }).handle(async () => {}),
      );

      const record = sesRecord({ ses: { mail: { source: 'sender@example.com' } } });
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(record);

      expect(result).toBeDefined();
    });

    test('does not match route when senders do not match', async ({ sesRecord }) => {
      matcher.route(
        defineRoute({
          filters: { sender: 'other@example.com' },
        }).handle(async () => {}),
      );

      const record = sesRecord({ ses: { mail: { source: 'user@example.com' } } });
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(record);

      expect(result).toBeUndefined();
    });

    test('matches route by sender wildcard', async ({ sesRecord }) => {
      matcher.route(
        defineRoute({
          filters: { sender: '*@example.com' },
        }).handle(async () => {}),
      );

      const record = sesRecord({ ses: { mail: { source: 'user@example.com' } } });
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(record);

      expect(result).toBeDefined();
    });

    test('matches route by sender wildcard array', async ({ sesRecord }) => {
      matcher.route(
        defineRoute({
          filters: { sender: ['*@example.com', '*@test.com'] },
        }).handle(async () => {}),
      );

      const record = sesRecord({ ses: { mail: { source: 'user@example.com' } } });
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(record);

      expect(result).toBeDefined();
    });

    test('does not match route when senderDomain wildcard do not match', async ({ sesRecord }) => {
      matcher.route(
        defineRoute({
          filters: { sender: '*@other.com' },
        }).handle(async () => {}),
      );

      const record = sesRecord({ ses: { mail: { source: 'user@example.com' } } });
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(record);

      expect(result).toBeUndefined();
    });

    test('matches route by recipient wildcard', async ({ sesRecord }) => {
      matcher.route(
        defineRoute({
          filters: { recipient: '*@example.com' },
        }).handle(async () => {}),
      );

      const record = sesRecord({ ses: { receipt: { recipients: ['user@example.com'] } } });
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(record);

      expect(result).toBeDefined();
    });

    test('does not match when recipient is an empty string', async ({ sesRecord }) => {
      matcher.route(
        defineRoute({
          filters: { recipient: '' },
        }).handle(async () => {}),
      );

      const record = sesRecord({ ses: { receipt: { recipients: ['user@example.com'] } } });
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(record);

      expect(result).toBeUndefined();
    });

    test('matches route by recipient wildcard array', async ({ sesRecord }) => {
      matcher.route(
        defineRoute({
          filters: { recipient: ['*@example.com', '*@test.com'] },
        }).handle(async () => {}),
      );

      const record = sesRecord({ ses: { receipt: { recipients: ['user@example.com'] } } });
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(record);

      expect(result).toBeDefined();
    });

    test('does not match route when recipient wildcard do not match', async ({ sesRecord }) => {
      matcher.route(
        defineRoute({
          filters: { recipient: '*@other.com' },
        }).handle(async () => {}),
      );

      const record = sesRecord({ ses: { receipt: { recipients: ['user@example.com'] } } });
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(record);

      expect(result).toBeUndefined();
    });

    test('matches when one of multiple recipient wildcard matches', async ({ sesRecord }) => {
      matcher.route(
        defineRoute({
          filters: { recipient: '*@example.com' },
        }).handle(async () => {}),
      );

      const record = sesRecord({
        ses: { receipt: { recipients: ['nobody@other.com', 'recipient@example.com'] } },
      });
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(record);

      expect(result).toBeDefined();
    });

    const verdictTypes = ['spamVerdict', 'virusVerdict', 'spfVerdict', 'dkimVerdict', 'dmarcVerdict'] as const;

    for (const verdictType of verdictTypes) {
      test(`matches route by ${verdictType}`, async ({ sesRecord }) => {
        matcher.route(
          defineRoute({
            filters: { [verdictType]: 'PASS' },
          }).handle(async () => {}),
        );

        const record = sesRecord({ ses: { receipt: { [verdictType]: { status: 'PASS' } } } });
        // @ts-expect-error - testing private method directly
        const result = await matcher.matchRoute(record);

        expect(result).toBeDefined();
      });

      test(`matches route by ${verdictType} array`, async ({ sesRecord }) => {
        matcher.route(
          defineRoute({
            filters: { [verdictType]: ['PASS', 'DISABLED'] },
          }).handle(async () => {}),
        );

        const record = sesRecord({ ses: { receipt: { [verdictType]: { status: 'PASS' } } } });
        // @ts-expect-error - testing private method directly
        const result = await matcher.matchRoute(record);

        expect(result).toBeDefined();
      });

      test(`does not match route when ${verdictType} does not match`, async ({ sesRecord }) => {
        matcher.route(
          defineRoute({
            filters: { [verdictType]: 'FAIL' },
          }).handle(async () => {}),
        );

        const record = sesRecord({ ses: { receipt: { [verdictType]: { status: 'PASS' } } } });
        // @ts-expect-error - testing private method directly
        const result = await matcher.matchRoute(record);

        expect(result).toBeUndefined();
      });
    }

    test('matches verdict with multiple allowed values', async ({ sesRecord }) => {
      matcher.route(
        defineRoute({
          filters: { spamVerdict: ['PASS', 'GRAY'] },
        }).handle(async () => {}),
      );

      const record = sesRecord({ ses: { receipt: { spamVerdict: { status: 'GRAY' } } } });
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(record);

      expect(result).toBeDefined();
    });

    test('matches route by custom returning true', async ({ sesRecord }) => {
      matcher.route(
        defineRoute({
          filters: {
            custom: (): boolean => true,
          },
        }).handle(async () => {}),
      );

      const record = sesRecord();
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(record);

      expect(result).toBeDefined();
    });

    test('does not match route when custom returns false', async ({ sesRecord }) => {
      matcher.route(
        defineRoute({
          filters: {
            custom: (): boolean => false,
          },
        }).handle(async () => {}),
      );

      const record = sesRecord();
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(record);

      expect(result).toBeUndefined();
    });

    test('custom receives receipt and mail', async ({ sesRecord }) => {
      const filterSpy = vi.fn((): boolean => true);
      matcher.route(
        defineRoute({
          filters: { custom: filterSpy },
        }).handle(async () => {}),
      );

      const record = sesRecord();
      // @ts-expect-error - testing private method directly
      await matcher.matchRoute(record);

      expect(filterSpy).toHaveBeenCalledWith({
        receipt: record.ses.receipt,
        mail: record.ses.mail,
      });
    });

    test('custom is not evaluated when an earlier filter fails', async ({ sesRecord }) => {
      const filterSpy = vi.fn((): boolean => true);
      matcher.route(
        defineRoute({
          filters: {
            recipient: 'nonexistent@example.com',
            custom: filterSpy,
          },
        }).handle(async () => {}),
      );

      const record = sesRecord({ ses: { receipt: { recipients: ['user@example.com'] } } });
      // @ts-expect-error - testing private method directly
      await matcher.matchRoute(record);

      expect(filterSpy).not.toHaveBeenCalled();
    });

    test('matches route by async custom returning true', async ({ sesRecord }) => {
      matcher.route(
        defineRoute({
          filters: {
            custom: async (): Promise<boolean> => {
              await new Promise((r) => setTimeout(r, 1));
              return true;
            },
          },
        }).handle(async () => {}),
      );

      const record = sesRecord();
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(record);

      expect(result).toBeDefined();
    });

    test('matches route with empty filters as a catch-all', async ({ sesRecord }) => {
      matcher.route(
        defineRoute({
          filters: {},
        }).handle(async () => {}),
      );

      const record = sesRecord();
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(record);

      expect(result).toBeDefined();
    });

    test('selects the first matching route when multiple routes match', async ({ sesRecord }) => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();

      matcher.route(
        defineRoute({
          filters: { recipient: 'recipient@example.com' },
        }).handle(firstHandler),
      );
      matcher.route(
        defineRoute({
          filters: { recipient: 'recipient@example.com' },
        }).handle(secondHandler),
      );

      const record = sesRecord({ ses: { receipt: { recipients: ['recipient@example.com'] } } });
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(record);

      expect(result).toBeDefined();
      expect(result?.handler).toBe(firstHandler);
    });

    test('orders an exact recipient ahead of the wildcard that covers it', async ({ sesRecord }) => {
      const wildcard = vi.fn();
      const exact = vi.fn();

      matcher.route(defineRoute({ filters: { recipient: '*@example.com' } }).handle(wildcard));
      matcher.route(defineRoute({ filters: { recipient: 'recipient@example.com' } }).handle(exact));

      const record = sesRecord({ ses: { receipt: { recipients: ['recipient@example.com'] } } });
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(record);

      expect(result?.handler).toBe(exact);
    });

    test('orders a guarded route ahead of the fallback it shares filters with', async ({ sesRecord }) => {
      const fallback = vi.fn();
      const guarded = vi.fn();

      matcher.route(defineRoute({ filters: { recipient: 'recipient@example.com' } }).handle(fallback));
      matcher.route(
        defineRoute({ filters: { recipient: 'recipient@example.com', custom: () => true } }).handle(guarded),
      );

      const record = sesRecord({ ses: { receipt: { recipients: ['recipient@example.com'] } } });
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(record);

      expect(result?.handler).toBe(guarded);
    });

    test('matches when both recipients and senders match', async ({ sesRecord }) => {
      matcher.route(
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
      const result = await matcher.matchRoute(record);

      expect(result).toBeDefined();
    });

    test('does not match when recipients match but senders do not', async ({ sesRecord }) => {
      matcher.route(
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
      const result = await matcher.matchRoute(record);

      expect(result).toBeUndefined();
    });

    test('does not match when senders match but recipients do not', async ({ sesRecord }) => {
      matcher.route(
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
      const result = await matcher.matchRoute(record);

      expect(result).toBeUndefined();
    });

    test('matches when both sender wildcard and recipient wildcard match', async ({ sesRecord }) => {
      matcher.route(
        defineRoute({
          filters: {
            sender: '*@example.com',
            recipient: '*@example.com',
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
      const result = await matcher.matchRoute(record);

      expect(result).toBeDefined();
    });

    test('does not match when sender wildcard match but recipient wildcard do not', async ({ sesRecord }) => {
      matcher.route(
        defineRoute({
          filters: {
            sender: '*@example.com',
            recipient: '*@other.com',
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
      const result = await matcher.matchRoute(record);

      expect(result).toBeUndefined();
    });

    test('matches when recipients, spamVerdict, and virusVerdict all match', async ({ sesRecord }) => {
      matcher.route(
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
      const result = await matcher.matchRoute(record);

      expect(result).toBeDefined();
    });
  });

  suite('buildRequest', () => {
    test('builds request with all expected properties', ({ sesRecord, context }) => {
      const record = sesRecord();
      const { mail, receipt } = record.ses;
      const mockContext = context();

      // @ts-expect-error - testing private method directly
      const request = matcher.buildRequest(record, mail, receipt, mockContext);

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
      const request = matcher.buildRequest(record, mail, receipt, mockContext);

      expect(request.subject).toBeUndefined();
    });
  });

  suite('handleEvent', () => {
    test('calls matched handler with correct SESRequest shape', async ({ sesRecord, sesHandlerEvent }) => {
      const handler = vi.fn();
      matcher.route(
        defineRoute({
          filters: { recipient: 'recipient@example.com' },
        }).handle(handler),
      );

      const record = sesRecord({ ses: { receipt: { recipients: ['recipient@example.com'] } } });
      const { event, context } = sesHandlerEvent({ records: [record] });
      await matcher.handleEvent(event, context);

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

    test('returns a CONTINUE disposition when the handler returns nothing', async ({ sesHandlerEvent }) => {
      matcher.route(
        defineRoute({
          filters: {},
        }).handle(async () => {}),
      );

      const { event, context } = sesHandlerEvent();
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual({ disposition: 'CONTINUE' });
    });

    test('returns the disposition the handler asks for', async ({ sesHandlerEvent }) => {
      matcher.route(
        defineRoute({
          filters: {},
        }).handle(async () => 'STOP_RULE_SET'),
      );

      const { event, context } = sesHandlerEvent();
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual({ disposition: 'STOP_RULE_SET' });
    });

    test('accepts a handler that returns the full result object', async ({ sesHandlerEvent }) => {
      matcher.route(
        defineRoute({
          filters: {},
        }).handle(async () => ({ disposition: 'STOP_RULE' })),
      );

      const { event, context } = sesHandlerEvent();
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual({ disposition: 'STOP_RULE' });
    });

    test('returns the strongest disposition across records', async ({ sesRecord, sesEvent, context }) => {
      matcher
        .route(
          defineRoute({
            filters: { sender: 'stop@example.com' },
          }).handle(async () => 'STOP_RULE'),
        )
        .route(
          defineRoute({
            filters: { sender: 'stopset@example.com' },
          }).handle(async () => 'STOP_RULE_SET'),
        )
        .route(
          defineRoute({
            filters: {},
          }).handle(async () => {}),
        );

      const records = [
        sesRecord({ ses: { mail: { source: 'plain@example.com' } } }),
        sesRecord({ ses: { mail: { source: 'stop@example.com' } } }),
        sesRecord({ ses: { mail: { source: 'stopset@example.com' } } }),
      ];
      const result = await matcher.handleEvent(sesEvent(records), context());

      expect(result).toEqual({ disposition: 'STOP_RULE_SET' });
    });

    test('prefers STOP_RULE over CONTINUE across records', async ({ sesRecord, sesEvent, context }) => {
      matcher
        .route(
          defineRoute({
            filters: { sender: 'stop@example.com' },
          }).handle(async () => 'STOP_RULE'),
        )
        .route(
          defineRoute({
            filters: {},
          }).handle(async () => {}),
        );

      const records = [
        sesRecord({ ses: { mail: { source: 'plain@example.com' } } }),
        sesRecord({ ses: { mail: { source: 'stop@example.com' } } }),
      ];
      const result = await matcher.handleEvent(sesEvent(records), context());

      expect(result).toEqual({ disposition: 'STOP_RULE' });
    });

    test('lets middleware read and override the handler disposition', async ({ sesHandlerEvent }) => {
      async function forceStop(request: SESRequest, next: SESNext): Promise<SESResponse> {
        await next(request);
        return 'STOP_RULE_SET';
      }

      const matcher = createSESMatcher({ middleware: [forceStop] });
      matcher.route(
        defineRoute({
          filters: {},
        }).handle(async () => 'CONTINUE'),
      );

      const { event, context } = sesHandlerEvent();
      const result = await matcher.handleEvent(event, context);

      expect(result).toEqual({ disposition: 'STOP_RULE_SET' });
    });

    test('throws when no route matches', async ({ sesHandlerEvent }) => {
      const { event, context } = sesHandlerEvent();
      await expect(matcher.handleEvent(event, context)).rejects.toThrow('No route matched');
    });

    test('throws with messageId in error message', async ({ sesRecord, sesHandlerEvent }) => {
      const record = sesRecord();

      const { event, context } = sesHandlerEvent({ records: [record] });
      await expect(matcher.handleEvent(event, context)).rejects.toThrow(record.ses.mail.messageId);
    });

    test('propagates handler error', async ({ sesHandlerEvent }) => {
      matcher.route(
        defineRoute({
          filters: {},
        }).handle(async () => {
          throw new Error('handler exploded');
        }),
      );

      const { event, context } = sesHandlerEvent();
      await expect(matcher.handleEvent(event, context)).rejects.toThrow('handler exploded');
    });

    test('processes records in parallel', async ({ sesRecord, sesEvent, context }) => {
      const callOrder: string[] = [];

      matcher.route(
        defineRoute({
          filters: {},
        }).handle(async (request) => {
          const messageId = request.record.ses.mail.messageId;
          callOrder.push(`start-${messageId}`);
          await new Promise((resolve) => setTimeout(resolve, 1));
          callOrder.push(`end-${messageId}`);
        }),
      );

      const recordA = sesRecord();
      const recordB = sesRecord();
      const event = sesEvent([recordA, recordB]);
      await matcher.handleEvent(event, context());

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

      matcher.route(
        defineRoute({
          filters: { sender: '*@internal.com' },
        }).handle(internalHandler),
      );
      matcher.route(
        defineRoute({
          filters: { sender: '*@external.com' },
        }).handle(externalHandler),
      );

      const records = [
        sesRecord({ ses: { mail: { source: 'alice@internal.com' } } }),
        sesRecord({ ses: { mail: { source: 'bob@internal.com' } } }),
        sesRecord({ ses: { mail: { source: 'carol@external.com' } } }),
      ];
      const event = sesEvent(records);
      const result = await matcher.handleEvent(event, context());

      expect(result).toEqual({ disposition: 'CONTINUE' });
      expect(internalHandler).toHaveBeenCalledTimes(2);
      expect(externalHandler).toHaveBeenCalledTimes(1);
    });
  });

  suite('matcher-level middleware', () => {
    test('executes middleware before the route handler', async ({ sesHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middleware(request: SESRequest, next: SESNext): Promise<void> {
        callOrder.push('mw-pre');
        await next(request);
        callOrder.push('mw-post');
      }

      const matcher = createSESMatcher({ middleware: [middleware] });
      matcher.route({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = sesHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
    });

    test('allows middleware to skip a record by not calling next', async ({ sesHandlerEvent }) => {
      const handler = vi.fn();

      async function skipMiddleware(_request: SESRequest, _next: SESNext): Promise<void> {
        return;
      }

      const matcher = createSESMatcher({ middleware: [skipMiddleware] });
      matcher.route({ filters: {}, handler });

      const { event, context } = sesHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple matcher-level middleware in order', async ({ sesHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middlewareOne(request: SESRequest, next: SESNext): Promise<void> {
        callOrder.push('mw1');
        await next(request);
      }

      async function middlewareTwo(request: SESRequest, next: SESNext): Promise<void> {
        callOrder.push('mw2');
        await next(request);
      }

      const matcher = createSESMatcher({ middleware: [middlewareOne, middlewareTwo] });
      matcher.route({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = sesHandlerEvent();
      await matcher.handleEvent(event, context);

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

      matcher.route({
        filters: {},
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = sesHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });

    test('allows route-level middleware to short-circuit by not calling next', async ({ sesHandlerEvent }) => {
      const handler = vi.fn();

      async function blockingRouteMiddleware(_request: SESRequest, _next: SESNext): Promise<void> {
        return;
      }

      matcher.route({ filters: {}, middleware: [blockingRouteMiddleware], handler });

      const { event, context } = sesHandlerEvent();
      await matcher.handleEvent(event, context);

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

      matcher.route({
        filters: {},
        middleware: [routeMiddlewareOne, routeMiddlewareTwo],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = sesHandlerEvent();
      await matcher.handleEvent(event, context);

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

      matcher.route(route);

      const { event, context } = sesHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });
  });

  suite('combined matcher and route middleware', () => {
    test('executes matcher middleware before route middleware', async ({ sesHandlerEvent }) => {
      const callOrder: string[] = [];

      async function matcherMiddleware(request: SESRequest, next: SESNext): Promise<void> {
        callOrder.push('matcher-mw');
        await next(request);
      }

      async function routeMiddleware(request: SESRequest, next: SESNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      const matcher = createSESMatcher({ middleware: [matcherMiddleware] });
      matcher.route({
        filters: {},
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = sesHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['matcher-mw', 'route-mw', 'handler']);
    });

    test('matcher middleware short-circuit prevents route middleware from running', async ({ sesHandlerEvent }) => {
      const routeMiddleware = vi.fn();
      const handler = vi.fn();

      async function blockingMatcherMiddleware(_request: SESRequest, _next: SESNext): Promise<void> {
        return;
      }

      const matcher = createSESMatcher({ middleware: [blockingMatcherMiddleware] });
      matcher.route({ filters: {}, middleware: [routeMiddleware], handler });

      const { event, context } = sesHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(routeMiddleware).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });
  });
});

suite('SESMatcher.canHandleEvent', () => {
  const ownEvents = ['createSESEvent'];

  test.each(allEventBuilders())('%s', async (name, build) => {
    const event = build();
    const isOwnEvent = ownEvents.includes(name);

    const claimed = await createSESMatcher().canHandleEvent(event);

    expect(claimed).toBe(isOwnEvent);
  });
});
