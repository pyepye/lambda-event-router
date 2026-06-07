import type { MockInstance } from 'vitest';

import * as base from '@lambda-event-router/base';
import { createActiveMQEvent, createActiveMQHandlerEvent, createMockSchema, test } from '@lambda-event-router/testing';

import { ActiveMQRouter, createActiveMQRouter, defineActiveMQRoute } from './ActiveMQRouter.js';
import type {
  ActiveMQBytesMessageRequest,
  ActiveMQFilterInput,
  ActiveMQFilters,
  ActiveMQRequest,
  ActiveMQTextMessageRequest,
} from './types.js';

type ActiveMQNext = (request: ActiveMQRequest) => Promise<void>;

const validateSchemaSpy: MockInstance = vi.spyOn(base, 'validateSchema');
const safeJsonParseSpy: MockInstance = vi.spyOn(base, 'safeJsonParse');

suite('ActiveMQRouter', () => {
  let router: ActiveMQRouter;

  beforeEach(() => {
    router = new ActiveMQRouter();
  });

  suite('createActiveMQRouter', () => {
    test('creates an ActiveMQRouter instance', () => {
      const router = createActiveMQRouter();
      expect(router).toBeInstanceOf(ActiveMQRouter);
    });
  });

  suite('defineActiveMQRoute', () => {
    test('returns a route builder with a handle method', () => {
      const builder = defineActiveMQRoute({
        filters: { eventSourceArn: 'arn:aws:mq:us-east-1:123456789012:broker:TestBroker:b-1234' },
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });

    test('rejects an unknown messageType at compile time', () => {
      defineActiveMQRoute({
        filters: {
          // @ts-expect-error - 'jms/text' is a typo, not an ActiveMQMessageType
          messageType: 'jms/text',
        },
      }).handle(async () => {});
    });

    test('rejects a bodySchema on a bytes route at compile time', () => {
      defineActiveMQRoute({
        filters: { messageType: 'jms/bytes-message' },
        // @ts-expect-error - a bytes body is a Buffer, so a bytes route takes no bodySchema
        bodySchema: createMockSchema(),
      }).handle(async ({ body }) => {
        // body is a Buffer, whatever schema was wrongly supplied
        const bytes: Buffer = body;
        void bytes;
      });
    });

    test('preserves filters, bodySchema, and handler in the definition', () => {
      const bodySchema = createMockSchema();
      const handler = vi.fn();
      const filters: ActiveMQFilters = {
        eventSourceArn: 'arn:aws:mq:us-east-1:123456789012:broker:TestBroker:b-1234',
        messageType: 'jms/text-message',
        destination: 'test-queue',
      };

      const definition = defineActiveMQRoute({
        filters,
        bodySchema,
      }).handle(handler);

      expect(definition.filters).toBe(filters);
      expect(definition.bodySchema).toBe(bodySchema);
      expect(definition.handler).toBe(handler);
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for a valid ActiveMQ event', () => {
      const event = createActiveMQEvent();
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns false for wrong eventSource', () => {
      const event = { eventSource: 'aws:sqs', messages: [] };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for null', () => {
      expect(router.canHandleEvent(null)).toBe(false);
    });

    test('returns false when messages is not an array', () => {
      expect(router.canHandleEvent({ eventSource: 'aws:mq', messages: 'not-an-array' })).toBe(false);
    });

    test('returns false for non-object input', () => {
      expect(router.canHandleEvent('string')).toBe(false);
    });
  });

  suite('route', () => {
    test('returns the router instance for chaining', () => {
      const definition = defineActiveMQRoute({
        filters: {},
      }).handle(async () => {});

      const result = router.route(definition);

      expect(result).toBe(router);
    });

    test('rejects a narrowed handler when the route does not filter messageType', () => {
      const textHandler = async (_request: ActiveMQTextMessageRequest): Promise<void> => {};
      router.route({
        filters: {},
        // @ts-expect-error - with no messageType filter the handler must accept the union
        handler: textHandler,
      });
    });

    test('accepts a narrowed handler when the route pins the messageType', () => {
      const textHandler = async (_request: ActiveMQTextMessageRequest): Promise<void> => {};
      router.route({
        filters: { messageType: 'jms/text-message' },
        handler: textHandler,
      });
    });
  });

  suite('textMessage', () => {
    test('returns the router instance for chaining', () => {
      const result = router.textMessage({
        filters: {},
        handler: async () => {},
      });

      expect(result).toBe(router);
    });

    test('only matches jms/text-message type messages', async ({ activeMQMessage }) => {
      router.textMessage({ filters: {}, handler: async () => {} });

      const event = createActiveMQEvent();
      const textMessage = activeMQMessage({ messageType: 'jms/text-message' });
      const bytesMessage = activeMQMessage({ messageType: 'jms/bytes-message' });

      // @ts-expect-error - testing private method directly
      const textResult = await router.matchRoute(event, textMessage);
      // @ts-expect-error - testing private method directly
      const bytesResult = await router.matchRoute(event, bytesMessage);

      expect(textResult).toBeDefined();
      expect(bytesResult).toBeUndefined();
    });
  });

  suite('bytesMessage', () => {
    test('returns the router instance for chaining', () => {
      const result = router.bytesMessage({
        filters: {},
        handler: async () => {},
      });

      expect(result).toBe(router);
    });

    test('only matches jms/bytes-message type messages', async ({ activeMQMessage }) => {
      router.bytesMessage({ filters: {}, handler: async () => {} });

      const event = createActiveMQEvent();
      const textMessage = activeMQMessage({ messageType: 'jms/text-message' });
      const bytesMessage = activeMQMessage({ messageType: 'jms/bytes-message' });

      // @ts-expect-error - testing private method directly
      const textResult = await router.matchRoute(event, textMessage);
      // @ts-expect-error - testing private method directly
      const bytesResult = await router.matchRoute(event, bytesMessage);

      expect(textResult).toBeUndefined();
      expect(bytesResult).toBeDefined();
    });
  });

  suite('matchRoute', () => {
    test('matches route by eventSourceArn', async ({ activeMQMessage }) => {
      const arn = 'arn:aws:mq:us-east-1:123456789012:broker:TestBroker:b-1234';
      router.route(
        defineActiveMQRoute({
          filters: { eventSourceArn: arn },
        }).handle(async () => {}),
      );

      const event = createActiveMQEvent();
      event.eventSourceArn = arn;
      const message = activeMQMessage();

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(event, message);

      expect(result).toBeDefined();
    });

    test('matches route by eventSourceArn array', async ({ activeMQMessage }) => {
      const arn = 'arn:aws:mq:us-east-1:123456789012:broker:TestBroker:b-1234';
      const arn2 = 'arn:aws:mq:eu-west-2:987654321098:broker:OtherBroker:z-9876';
      router.route(
        defineActiveMQRoute({
          filters: { eventSourceArn: [arn, arn2] },
        }).handle(async () => {}),
      );

      const event = createActiveMQEvent();
      event.eventSourceArn = arn;
      const message = activeMQMessage();

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(event, message);

      expect(result).toBeDefined();
    });

    test('does not match when eventSourceArn does not match', async ({ activeMQMessage }) => {
      router.route(
        defineActiveMQRoute({
          filters: { eventSourceArn: 'arn:aws:mq:us-east-1:123456789012:broker:OtherBroker:b-9999' },
        }).handle(async () => {}),
      );

      const event = createActiveMQEvent();
      const message = activeMQMessage();

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(event, message);

      expect(result).toBeUndefined();
    });

    test('matches route by messageType', async ({ activeMQMessage }) => {
      router.route(
        defineActiveMQRoute({
          filters: { messageType: 'jms/text-message' },
        }).handle(async () => {}),
      );

      const event = createActiveMQEvent();
      const message = activeMQMessage({ messageType: 'jms/text-message' });

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(event, message);

      expect(result).toBeDefined();
    });

    test('matches route by messageType array', async ({ activeMQMessage }) => {
      router.route(
        defineActiveMQRoute({
          filters: { messageType: ['jms/text-message', 'jms/bytes-message'] },
        }).handle(async () => {}),
      );

      const event = createActiveMQEvent();
      const message = activeMQMessage({ messageType: 'jms/text-message' });

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(event, message);

      expect(result).toBeDefined();
    });

    test('does not match when messageType does not match', async ({ activeMQMessage }) => {
      router.route(
        defineActiveMQRoute({
          filters: { messageType: 'jms/bytes-message' },
        }).handle(async () => {}),
      );

      const event = createActiveMQEvent();
      const message = activeMQMessage({ messageType: 'jms/text-message' });

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(event, message);

      expect(result).toBeUndefined();
    });

    test('matches route by destination', async ({ activeMQMessage }) => {
      router.route(
        defineActiveMQRoute({
          filters: { destination: 'orders-queue' },
        }).handle(async () => {}),
      );

      const event = createActiveMQEvent();
      const message = activeMQMessage({ destination: { physicalName: 'orders-queue' } });

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(event, message);

      expect(result).toBeDefined();
    });

    test('matches route by destination array', async ({ activeMQMessage }) => {
      router.route(
        defineActiveMQRoute({
          filters: { destination: ['orders-queue', 'refunds-queue'] },
        }).handle(async () => {}),
      );

      const event = createActiveMQEvent();
      const message = activeMQMessage({ destination: { physicalName: 'orders-queue' } });

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(event, message);

      expect(result).toBeDefined();
    });

    test('does not match when destination does not match', async ({ activeMQMessage }) => {
      router.route(
        defineActiveMQRoute({
          filters: { destination: 'orders-queue' },
        }).handle(async () => {}),
      );

      const event = createActiveMQEvent();
      const message = activeMQMessage({ destination: { physicalName: 'users-queue' } });

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(event, message);

      expect(result).toBeUndefined();
    });

    test('matches route by custom', async ({ activeMQMessage }) => {
      router.route(
        defineActiveMQRoute({
          filters: {
            custom: ({ destination }: ActiveMQFilterInput): boolean => {
              return destination === 'test-queue';
            },
          },
        }).handle(async () => {}),
      );

      const event = createActiveMQEvent();
      const message = activeMQMessage({ destination: { physicalName: 'test-queue' } });

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(event, message);

      expect(result).toBeDefined();
    });

    test('does not match when custom returns false', async ({ activeMQMessage }) => {
      router.route(
        defineActiveMQRoute({
          filters: { custom: (): boolean => false },
        }).handle(async () => {}),
      );

      const event = createActiveMQEvent();
      const message = activeMQMessage();

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(event, message);

      expect(result).toBeUndefined();
    });

    test('custom receives correct ActiveMQFilterInput', async ({ activeMQMessage }) => {
      const filterSpy = vi.fn().mockReturnValue(true);
      router.route(
        defineActiveMQRoute({
          filters: { custom: filterSpy },
        }).handle(async () => {}),
      );

      const event = createActiveMQEvent();
      const message = activeMQMessage({
        messageType: 'jms/text-message',
        destination: { physicalName: 'orders-queue' },
      });

      // @ts-expect-error - testing private method directly
      await router.matchRoute(event, message, message);

      expect(filterSpy).toHaveBeenCalledWith({
        messageType: 'jms/text-message',
        destination: 'orders-queue',
        message,
        record: message,
      });
    });

    test('custom filter receives the raw record and the decoded message', async ({ activeMQMessage, context }) => {
      let filterInput: ActiveMQFilterInput | undefined;
      router.route(
        defineActiveMQRoute({
          filters: {
            custom: (input: ActiveMQFilterInput): boolean => {
              filterInput = input;
              return true;
            },
          },
        }).handle(async () => {}),
      );

      const body = { action: 'process' };
      const message = activeMQMessage({ messageType: 'jms/text-message', data: body });
      const event = createActiveMQEvent([message]);
      await router.handleEvent(event, context());

      // record is the untouched AWS message, so its data is still base64
      expect(filterInput?.record.data).toBe(message.data);
      // message has data decoded to text, matching request.message
      expect(filterInput?.message.data).toBe(JSON.stringify(body));
    });

    test('custom is not called when a preceding filter rejects', async ({ activeMQMessage }) => {
      const customFilterSpy = vi.fn().mockReturnValue(true);
      router.route(
        defineActiveMQRoute({
          filters: { messageType: 'jms/bytes-message', custom: customFilterSpy },
        }).handle(async () => {}),
      );

      const event = createActiveMQEvent();
      const message = activeMQMessage({ messageType: 'jms/text-message' });

      // @ts-expect-error - testing private method directly
      await router.matchRoute(event, message);

      expect(customFilterSpy).not.toHaveBeenCalled();
    });

    test('matches route by async custom', async ({ activeMQMessage }) => {
      router.route(
        defineActiveMQRoute({
          filters: {
            custom: async ({ destination }: ActiveMQFilterInput): Promise<boolean> => {
              await new Promise((r) => setTimeout(r, 1));
              return destination === 'test-queue';
            },
          },
        }).handle(async () => {}),
      );

      const event = createActiveMQEvent();
      const message = activeMQMessage({ destination: { physicalName: 'test-queue' } });

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(event, message);

      expect(result).toBeDefined();
    });

    test('matches route with empty filters as a catch-all', async ({ activeMQMessage }) => {
      router.route(
        defineActiveMQRoute({
          filters: {},
        }).handle(async () => {}),
      );

      const event = createActiveMQEvent();
      const message = activeMQMessage();

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(event, message);

      expect(result).toBeDefined();
    });

    test('selects the first matching route when multiple routes match', async ({ activeMQMessage }) => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();
      router.route(defineActiveMQRoute({ filters: {} }).handle(firstHandler));
      router.route(defineActiveMQRoute({ filters: {} }).handle(secondHandler));

      const event = createActiveMQEvent();
      const message = activeMQMessage();

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(event, message);

      expect(result).toBeDefined();
      expect(result?.handler).toBe(firstHandler);
    });
  });

  suite('handleEvent', () => {
    test('calls matched handler with correct ActiveMQRequest shape', async ({
      activeMQMessage,
      activeMQHandlerEvent,
    }) => {
      const handler = vi.fn();
      router.route(defineActiveMQRoute({ filters: {} }).handle(handler));

      const message = activeMQMessage({
        messageType: 'jms/bytes-message',
        destination: { physicalName: 'orders-queue' },
      });
      const { event, context } = activeMQHandlerEvent({ messages: [message] });
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          destination: 'orders-queue',
          messageType: 'jms/bytes-message',
          record: message,
          context,
        }),
      );
    });

    test('decodes base64 message data', async ({ activeMQMessage, context }) => {
      const handler = vi.fn();
      router.route(defineActiveMQRoute({ filters: {} }).handle(handler));

      const body = { decoded: true }; // This gets auto encoded by activeMQMessage
      const message = activeMQMessage({ data: body });
      const event = createActiveMQEvent([message]);

      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledTimes(1);
      const expectedDecodedData = JSON.stringify(body);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.objectContaining({ data: expectedDecodedData }),
          body,
        }),
      );
    });

    test('hands a bytes message its data as a Buffer of the original bytes', async ({ activeMQMessage, context }) => {
      let received: ActiveMQBytesMessageRequest | undefined;
      router.bytesMessage({
        filters: {},
        handler: async (request: ActiveMQBytesMessageRequest) => {
          received = request;
        },
      });

      // Bytes that are not valid UTF-8, so a UTF-8 decode would corrupt them
      const binary = Buffer.from([0xff, 0xfe, 0x00, 0x01, 0x80]);
      const base64 = binary.toString('base64');
      const message = activeMQMessage({ messageType: 'jms/bytes-message' });
      message.data = base64;
      const event = createActiveMQEvent([message]);

      await router.handleEvent(event, context());

      expect(received).toBeDefined();
      expect(Buffer.isBuffer(received?.body)).toBe(true);
      expect(received?.body.equals(binary)).toBe(true);
      // The raw base64 is still reachable on record.data
      expect(received?.record.data).toBe(base64);
    });

    test('validates body with schema and returns transformed data', async ({ activeMQMessage, context }) => {
      const handler = vi.fn();
      const bodySchema = createMockSchema();
      router.route(defineActiveMQRoute({ filters: {}, bodySchema }).handle(handler));

      const body = { action: 'process' };
      const message = activeMQMessage({ data: body });
      const event = createActiveMQEvent([message]);
      await router.handleEvent(event, context());

      expect(validateSchemaSpy).toHaveBeenCalledWith(body, bodySchema, expect.any(String));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body }));
    });

    test('throws when body schema validation fails', async ({ activeMQMessage, context }) => {
      const bodySchema = createMockSchema({ issues: [{ message: 'invalid' }] });

      router.route(defineActiveMQRoute({ filters: {}, bodySchema }).handle(vi.fn()));

      const message = activeMQMessage({ data: { bad: 'data' } });
      const event = createActiveMQEvent([message]);

      await expect(router.handleEvent(event, context())).rejects.toThrow('Body validation failed');
    });

    test('throws when no route matches', async ({ activeMQHandlerEvent }) => {
      const { event, context } = activeMQHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('No route matched');
    });

    test('propagates handler errors', async ({ activeMQHandlerEvent }) => {
      router.route(
        defineActiveMQRoute({ filters: {} }).handle(async () => {
          throw new Error('handler exploded');
        }),
      );

      const { event, context } = activeMQHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('handler exploded');
    });

    test('returns undefined on success', async ({ activeMQHandlerEvent }) => {
      router.route(defineActiveMQRoute({ filters: {} }).handle(async () => {}));

      const { event, context } = activeMQHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toBeUndefined();
    });

    test('processes messages sequentially', async ({ activeMQMessage, context }) => {
      const callOrder: string[] = [];

      router.route(
        defineActiveMQRoute({ filters: {} }).handle(async (request: ActiveMQRequest) => {
          const messageId = request.record.messageID;
          callOrder.push(`start-${messageId}`);
          await new Promise((resolve) => setTimeout(resolve, 1));
          callOrder.push(`end-${messageId}`);
        }),
      );

      const messageA = activeMQMessage();
      const messageB = activeMQMessage();
      const event = createActiveMQEvent([messageA, messageB]);
      await router.handleEvent(event, context());

      expect(callOrder).toEqual([
        `start-${messageA.messageID}`,
        `end-${messageA.messageID}`,
        `start-${messageB.messageID}`,
        `end-${messageB.messageID}`,
      ]);
    });
  });

  suite('handleEvent - jsonParse', () => {
    test('passes decoded message data to safeJsonParse', async ({ activeMQMessage, context }) => {
      const handler = vi.fn();
      router.route(defineActiveMQRoute({ filters: {} }).handle(handler));

      const body = { action: 'process', id: '123' };
      const message = activeMQMessage({ data: body });
      const event = createActiveMQEvent([message]);
      await router.handleEvent(event, context());

      expect(safeJsonParseSpy).toHaveBeenCalledWith(JSON.stringify(body));
    });

    test('handler receives parsed object when data is valid JSON', async ({ activeMQMessage, context }) => {
      const handler = vi.fn();
      router.route(defineActiveMQRoute({ filters: {} }).handle(handler));

      const body = { action: 'process', id: '123' };
      const message = activeMQMessage({ data: body });
      const event = createActiveMQEvent([message]);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body }));
    });

    test('handler receives raw string when data is not valid JSON', async ({ activeMQMessage, context }) => {
      const handler = vi.fn();
      router.route(defineActiveMQRoute({ filters: {} }).handle(handler));

      const message = activeMQMessage({ data: 'not-json' });
      const event = createActiveMQEvent([message]);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: 'not-json' }));
    });
  });

  suite('full event processing', () => {
    test('routes text and bytes messages to different handlers', async ({ activeMQMessage, context }) => {
      const textHandler = vi.fn();
      const bytesHandler = vi.fn();

      router.textMessage({ filters: {}, handler: textHandler });
      router.bytesMessage({ filters: {}, handler: bytesHandler });

      const textMsg = activeMQMessage({ messageType: 'jms/text-message' });
      const bytesMsg = activeMQMessage({ messageType: 'jms/bytes-message' });
      const event = createActiveMQEvent([textMsg, bytesMsg]);
      await router.handleEvent(event, context());

      expect(textHandler).toHaveBeenCalledTimes(1);
      expect(bytesHandler).toHaveBeenCalledTimes(1);
    });

    test('routes by eventSourceArn to different handlers', async ({ activeMQMessage, context }) => {
      const brokerAArn = 'arn:aws:mq:us-east-1:123456789012:broker:BrokerA:b-1111';
      const brokerBArn = 'arn:aws:mq:us-east-1:123456789012:broker:BrokerB:b-2222';

      const brokerAHandler = vi.fn();
      const brokerBHandler = vi.fn();

      router.route(defineActiveMQRoute({ filters: { eventSourceArn: brokerAArn } }).handle(brokerAHandler));
      router.route(defineActiveMQRoute({ filters: { eventSourceArn: brokerBArn } }).handle(brokerBHandler));

      const message = activeMQMessage();
      const eventA = createActiveMQEvent([message]);
      eventA.eventSourceArn = brokerAArn;
      await router.handleEvent(eventA, context());

      const eventB = createActiveMQEvent([activeMQMessage()]);
      eventB.eventSourceArn = brokerBArn;
      await router.handleEvent(eventB, context());

      expect(brokerAHandler).toHaveBeenCalledTimes(1);
      expect(brokerBHandler).toHaveBeenCalledTimes(1);
    });

    test('catch-all route handles all message types', async ({ activeMQMessage, context }) => {
      const handler = vi.fn();

      router.route(defineActiveMQRoute({ filters: {} }).handle(handler));

      const event = createActiveMQEvent([
        activeMQMessage({ messageType: 'jms/text-message' }),
        activeMQMessage({ messageType: 'jms/bytes-message' }),
      ]);
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  suite('router-level middleware', () => {
    test('executes middleware before the route handler', async () => {
      const callOrder: string[] = [];

      async function middleware(request: ActiveMQRequest, next: ActiveMQNext): Promise<void> {
        callOrder.push('mw-pre');
        await next(request);
        callOrder.push('mw-post');
      }

      const router = createActiveMQRouter({ middleware: [middleware] });
      router.route({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = createActiveMQHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
    });

    test('executes middleware per-record for multi-record events', async ({ activeMQMessage, context }) => {
      const recordIds: string[] = [];

      async function middleware(request: ActiveMQRequest, next: ActiveMQNext): Promise<void> {
        recordIds.push(request.record.messageID);
        await next(request);
      }

      const router = createActiveMQRouter({ middleware: [middleware] });
      router.route({ filters: {}, handler: async () => {} });

      const event = createActiveMQEvent([
        activeMQMessage({ messageID: 'evt-1' }),
        activeMQMessage({ messageID: 'evt-2' }),
      ]);
      await router.handleEvent(event, context());

      expect(recordIds).toEqual(['evt-1', 'evt-2']);
    });

    test('allows middleware to skip a record by not calling next', async () => {
      const handler = vi.fn();

      async function skipMiddleware(_request: ActiveMQRequest, _next: ActiveMQNext): Promise<void> {
        return;
      }

      const router = createActiveMQRouter({ middleware: [skipMiddleware] });
      router.route({ filters: {}, handler });

      const { event, context } = createActiveMQHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple router-level middleware in order', async () => {
      const callOrder: string[] = [];

      async function middlewareOne(request: ActiveMQRequest, next: ActiveMQNext): Promise<void> {
        callOrder.push('mw1');
        await next(request);
      }

      async function middlewareTwo(request: ActiveMQRequest, next: ActiveMQNext): Promise<void> {
        callOrder.push('mw2');
        await next(request);
      }

      const router = createActiveMQRouter({ middleware: [middlewareOne, middlewareTwo] });
      router.route({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = createActiveMQHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw1', 'mw2', 'handler']);
    });
  });

  suite('route-level middleware', () => {
    test('executes route-level middleware for a specific route', async () => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: ActiveMQRequest, next: ActiveMQNext): Promise<void> {
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

      const { event, context } = createActiveMQHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });

    test('allows route-level middleware to short-circuit by not calling next', async () => {
      const handler = vi.fn();

      async function blockingRouteMiddleware(_request: ActiveMQRequest, _next: ActiveMQNext): Promise<void> {
        return;
      }

      router.route({ filters: {}, middleware: [blockingRouteMiddleware], handler });

      const { event, context } = createActiveMQHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple route-level middleware in order', async () => {
      const callOrder: string[] = [];

      async function routeMiddlewareOne(request: ActiveMQRequest, next: ActiveMQNext): Promise<void> {
        callOrder.push('route-mw1');
        await next(request);
      }

      async function routeMiddlewareTwo(request: ActiveMQRequest, next: ActiveMQNext): Promise<void> {
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

      const { event, context } = createActiveMQHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw1', 'route-mw2', 'handler']);
    });

    test('supports middleware on defineRoute builder pattern', async () => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: ActiveMQRequest, next: ActiveMQNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      const route = defineActiveMQRoute({ filters: {}, middleware: [routeMiddleware] }).handle(async () => {
        callOrder.push('handler');
      });

      router.route(route);

      const { event, context } = createActiveMQHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });
  });

  suite('combined router and route middleware', () => {
    test('executes router middleware before route middleware', async () => {
      const callOrder: string[] = [];

      async function routerMiddleware(request: ActiveMQRequest, next: ActiveMQNext): Promise<void> {
        callOrder.push('router-mw');
        await next(request);
      }

      async function routeMiddleware(request: ActiveMQRequest, next: ActiveMQNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      const router = createActiveMQRouter({ middleware: [routerMiddleware] });
      router.route({
        filters: {},
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = createActiveMQHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['router-mw', 'route-mw', 'handler']);
    });

    test('router middleware short-circuit prevents route middleware from running', async () => {
      const routeMiddleware = vi.fn();
      const handler = vi.fn();

      async function blockingRouterMiddleware(_request: ActiveMQRequest, _next: ActiveMQNext): Promise<void> {
        return;
      }

      const router = createActiveMQRouter({ middleware: [blockingRouterMiddleware] });
      router.route({ filters: {}, middleware: [routeMiddleware], handler });

      const { event, context } = createActiveMQHandlerEvent();
      await router.handleEvent(event, context);

      expect(routeMiddleware).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  suite('middleware does not run on validation failure', () => {
    test('does not execute middleware when schema validation fails', async () => {
      const middleware = vi.fn();
      const bodySchema = createMockSchema({ issues: [{ message: 'invalid' }] });

      const router = createActiveMQRouter({ middleware: [middleware] });
      router.route({ filters: {}, bodySchema, handler: vi.fn() });

      const { event, context } = createActiveMQHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('validation failed');
      expect(middleware).not.toHaveBeenCalled();
    });
  });
});
