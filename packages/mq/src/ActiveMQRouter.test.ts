import * as base from '@lambda-event-router/base';
import { createActiveMQEvent, createMockSchema, test } from '@lambda-event-router/testing';
import type { MockInstance } from 'vitest';
import { ActiveMQRouter, createActiveMQRouter, defineActiveMQRoute } from './ActiveMQRouter.js';
import type { ActiveMQFilterInput, ActiveMQRequest } from './activeMQTypes.js';

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
        filters: { eventSourceArns: ['arn:aws:mq:us-east-1:123456789012:broker:TestBroker:b-1234'] },
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });

    test('preserves filters, bodySchema, and handler in the definition', () => {
      const bodySchema = createMockSchema();
      const handler = vi.fn();
      const filters = {
        eventSourceArns: ['arn:aws:mq:us-east-1:123456789012:broker:TestBroker:b-1234'],
        messageTypes: ['jms/text-message' as const],
        destinations: ['test-queue'],
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
  });

  suite('textMessage', () => {
    test('returns the router instance for chaining', () => {
      const result = router.textMessage({
        filters: {},
        handler: async () => {},
      });

      expect(result).toBe(router);
    });

    test('only matches jms/text-message type messages', ({ activeMQMessage }) => {
      router.textMessage({ filters: {}, handler: async () => {} });

      const event = createActiveMQEvent();
      const textMessage = activeMQMessage({ messageType: 'jms/text-message' });
      const bytesMessage = activeMQMessage({ messageType: 'jms/bytes-message' });

      // @ts-expect-error - testing private method directly
      const textResult = router.matchRoute(event, textMessage);
      // @ts-expect-error - testing private method directly
      const bytesResult = router.matchRoute(event, bytesMessage);

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

    test('only matches jms/bytes-message type messages', ({ activeMQMessage }) => {
      router.bytesMessage({ filters: {}, handler: async () => {} });

      const event = createActiveMQEvent();
      const textMessage = activeMQMessage({ messageType: 'jms/text-message' });
      const bytesMessage = activeMQMessage({ messageType: 'jms/bytes-message' });

      // @ts-expect-error - testing private method directly
      const textResult = router.matchRoute(event, textMessage);
      // @ts-expect-error - testing private method directly
      const bytesResult = router.matchRoute(event, bytesMessage);

      expect(textResult).toBeUndefined();
      expect(bytesResult).toBeDefined();
    });
  });

  suite('matchRoute', () => {
    test('matches route by eventSourceArns', ({ activeMQMessage }) => {
      const arn = 'arn:aws:mq:us-east-1:123456789012:broker:TestBroker:b-1234';
      router.route(
        defineActiveMQRoute({
          filters: { eventSourceArns: [arn] },
        }).handle(async () => {}),
      );

      const event = createActiveMQEvent();
      event.eventSourceArn = arn;
      const message = activeMQMessage();

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, message);

      expect(result).toBeDefined();
    });

    test('does not match when eventSourceArns does not match', ({ activeMQMessage }) => {
      router.route(
        defineActiveMQRoute({
          filters: { eventSourceArns: ['arn:aws:mq:us-east-1:123456789012:broker:OtherBroker:b-9999'] },
        }).handle(async () => {}),
      );

      const event = createActiveMQEvent();
      const message = activeMQMessage();

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, message);

      expect(result).toBeUndefined();
    });

    test('matches route by messageTypes', ({ activeMQMessage }) => {
      router.route(
        defineActiveMQRoute({
          filters: { messageTypes: ['jms/text-message'] },
        }).handle(async () => {}),
      );

      const event = createActiveMQEvent();
      const message = activeMQMessage({ messageType: 'jms/text-message' });

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, message);

      expect(result).toBeDefined();
    });

    test('does not match when messageTypes does not match', ({ activeMQMessage }) => {
      router.route(
        defineActiveMQRoute({
          filters: { messageTypes: ['jms/bytes-message'] },
        }).handle(async () => {}),
      );

      const event = createActiveMQEvent();
      const message = activeMQMessage({ messageType: 'jms/text-message' });

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, message);

      expect(result).toBeUndefined();
    });

    test('matches route by destinations', ({ activeMQMessage }) => {
      router.route(
        defineActiveMQRoute({
          filters: { destinations: ['orders-queue'] },
        }).handle(async () => {}),
      );

      const event = createActiveMQEvent();
      const message = activeMQMessage({ destination: { physicalName: 'orders-queue' } });

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, message);

      expect(result).toBeDefined();
    });

    test('does not match when destinations does not match', ({ activeMQMessage }) => {
      router.route(
        defineActiveMQRoute({
          filters: { destinations: ['orders-queue'] },
        }).handle(async () => {}),
      );

      const event = createActiveMQEvent();
      const message = activeMQMessage({ destination: { physicalName: 'users-queue' } });

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, message);

      expect(result).toBeUndefined();
    });

    test('matches route by customFilter', ({ activeMQMessage }) => {
      router.route(
        defineActiveMQRoute({
          filters: {
            customFilter: ({ destination }: ActiveMQFilterInput): boolean => {
              return destination === 'test-queue';
            },
          },
        }).handle(async () => {}),
      );

      const event = createActiveMQEvent();
      const message = activeMQMessage({ destination: { physicalName: 'test-queue' } });

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, message);

      expect(result).toBeDefined();
    });

    test('does not match when customFilter returns false', ({ activeMQMessage }) => {
      router.route(
        defineActiveMQRoute({
          filters: { customFilter: (): boolean => false },
        }).handle(async () => {}),
      );

      const event = createActiveMQEvent();
      const message = activeMQMessage();

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, message);

      expect(result).toBeUndefined();
    });

    test('customFilter receives correct ActiveMQFilterInput', ({ activeMQMessage }) => {
      const filterSpy = vi.fn().mockReturnValue(true);
      router.route(
        defineActiveMQRoute({
          filters: { customFilter: filterSpy },
        }).handle(async () => {}),
      );

      const event = createActiveMQEvent();
      const message = activeMQMessage({
        messageType: 'jms/text-message',
        destination: { physicalName: 'orders-queue' },
      });

      // @ts-expect-error - testing private method directly
      router.matchRoute(event, message);

      expect(filterSpy).toHaveBeenCalledWith({
        messageType: 'jms/text-message',
        destination: 'orders-queue',
        record: message,
      });
    });

    test('customFilter is not called when a preceding filter rejects', ({ activeMQMessage }) => {
      const customFilterSpy = vi.fn().mockReturnValue(true);
      router.route(
        defineActiveMQRoute({
          filters: { messageTypes: ['jms/bytes-message'], customFilter: customFilterSpy },
        }).handle(async () => {}),
      );

      const event = createActiveMQEvent();
      const message = activeMQMessage({ messageType: 'jms/text-message' });

      // @ts-expect-error - testing private method directly
      router.matchRoute(event, message);

      expect(customFilterSpy).not.toHaveBeenCalled();
    });

    test('matches route with empty filters as a catch-all', ({ activeMQMessage }) => {
      router.route(
        defineActiveMQRoute({
          filters: {},
        }).handle(async () => {}),
      );

      const event = createActiveMQEvent();
      const message = activeMQMessage();

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, message);

      expect(result).toBeDefined();
    });

    test('selects the first matching route when multiple routes match', ({ activeMQMessage }) => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();
      router.route(defineActiveMQRoute({ filters: {} }).handle(firstHandler));
      router.route(defineActiveMQRoute({ filters: {} }).handle(secondHandler));

      const event = createActiveMQEvent();
      const message = activeMQMessage();

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, message);

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
          await new Promise((resolve) => setTimeout(resolve, 10));
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

    test('routes by eventSourceArns to different handlers', async ({ activeMQMessage, context }) => {
      const brokerAArn = 'arn:aws:mq:us-east-1:123456789012:broker:BrokerA:b-1111';
      const brokerBArn = 'arn:aws:mq:us-east-1:123456789012:broker:BrokerB:b-2222';

      const brokerAHandler = vi.fn();
      const brokerBHandler = vi.fn();

      router.route(defineActiveMQRoute({ filters: { eventSourceArns: [brokerAArn] } }).handle(brokerAHandler));
      router.route(defineActiveMQRoute({ filters: { eventSourceArns: [brokerBArn] } }).handle(brokerBHandler));

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
});
