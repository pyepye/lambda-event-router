import type { Schema } from '@lambda-event-router/base';
import { createEventBridgeEvent, test } from '@lambda-event-router/testing';
import { createEventBridgeRouter, defineRoute, EventBridgeRouter } from './EventBridgeRouter.js';
import type { EventBridgeFilterInput, EventBridgeRequest } from './types.js';

suite('EventBridgeRouter', () => {
  suite('createEventBridgeRouter', () => {
    test('creates an EventBridgeRouter instance', () => {
      const router = createEventBridgeRouter();
      expect(router).toBeInstanceOf(EventBridgeRouter);
    });
  });

  suite('canHandleEvent', () => {
    let router: EventBridgeRouter;

    beforeEach(() => {
      router = new EventBridgeRouter();
    });

    test('returns true for an EventBridge envelope event', () => {
      const event = createEventBridgeEvent();
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns false for null', () => {
      expect(router.canHandleEvent(null)).toBe(false);
    });

    test('returns false for a string', () => {
      expect(router.canHandleEvent('not an event')).toBe(false);
    });

    test('returns false for an object without source', () => {
      expect(router.canHandleEvent({ 'detail-type': 'Test', detail: {} })).toBe(false);
    });

    test('returns false for an object without detail-type', () => {
      expect(router.canHandleEvent({ source: 'my.app', detail: {} })).toBe(false);
    });

    test('returns false for an object without detail', () => {
      expect(router.canHandleEvent({ source: 'my.app', 'detail-type': 'Test' })).toBe(false);
    });

    test('returns false for an arbitrary object without envelope fields', () => {
      expect(router.canHandleEvent({ taskId: 'task-123' })).toBe(false);
    });
  });

  suite('defineRoute', () => {
    test('preserves filters, detailSchema, and handler in EventBridge definition', () => {
      const detailSchema: Schema<{ orderId: string }> = {
        safeParse: (data: unknown) => ({ success: true, data: data as { orderId: string } }),
      };
      const handler = vi.fn();
      const filters = {
        sources: ['order.service'],
        detailTypes: ['OrderPlaced'],
      };

      const definition = defineRoute({
        filters,
        detailSchema,
      }).handle(handler);

      expect(definition).toEqual({
        filters,
        detailSchema,
        handler,
      });
    });
  });

  suite('route', () => {
    test('returns the router instance for chaining', () => {
      const router = new EventBridgeRouter();
      const definition = defineRoute({
        filters: { sources: ['my.app'] },
      }).handle(async () => {});

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  suite('matchRoute', () => {
    let router: EventBridgeRouter;

    beforeEach(() => {
      router = createEventBridgeRouter();
    });

    test('matches route by sources filter', ({ eventBridgeEvent }) => {
      router.route(
        defineRoute({
          filters: { sources: ['my.app'] },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('does not match route when sources filter does not match', ({ eventBridgeEvent }) => {
      router.route(
        defineRoute({
          filters: { sources: ['other.app'] },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeUndefined();
    });

    test('matches route by detailTypes filter', ({ eventBridgeEvent }) => {
      router.route(
        defineRoute({
          filters: { detailTypes: ['OrderPlaced'] },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('does not match route when detailTypes filter does not match', ({ eventBridgeEvent }) => {
      router.route(
        defineRoute({
          filters: { detailTypes: ['OrderShipped'] },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeUndefined();
    });

    test('matches route by accounts filter', ({ eventBridgeEvent }) => {
      router.route(
        defineRoute({
          filters: { accounts: ['123456789012'] },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('does not match route when accounts filter does not match', ({ eventBridgeEvent }) => {
      router.route(
        defineRoute({
          filters: { accounts: ['999999999999'] },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeUndefined();
    });

    test('matches route by regions filter', ({ eventBridgeEvent }) => {
      router.route(
        defineRoute({
          filters: { regions: ['us-east-1'] },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('does not match route when regions filter does not match', ({ eventBridgeEvent }) => {
      router.route(
        defineRoute({
          filters: { regions: ['eu-west-1'] },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeUndefined();
    });

    test('matches route by resources filter', ({ eventBridgeEvent }) => {
      const resourceArn = 'arn:aws:ec2:us-east-1:123456789012:instance/i-1234567890abcdef0';
      router.route(
        defineRoute({
          filters: { resources: [resourceArn] },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent({ resources: [resourceArn] });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('does not match route when resources filter does not match', ({ eventBridgeEvent }) => {
      router.route(
        defineRoute({
          filters: { resources: ['arn:aws:ec2:us-east-1:123456789012:instance/i-other'] },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent({
        resources: ['arn:aws:ec2:us-east-1:123456789012:instance/i-1234567890abcdef0'],
      });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeUndefined();
    });

    test('matches when all standard filters match together', ({ eventBridgeEvent }) => {
      router.route(
        defineRoute({
          filters: {
            sources: ['my.app'],
            detailTypes: ['OrderPlaced'],
            accounts: ['123456789012'],
            regions: ['us-east-1'],
          },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('does not match when one of multiple standard filters mismatches', ({ eventBridgeEvent }) => {
      router.route(
        defineRoute({
          filters: {
            sources: ['my.app'],
            detailTypes: ['OrderPlaced'],
            accounts: ['999999999999'],
          },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeUndefined();
    });

    test('matches route by customFilter', ({ eventBridgeEvent }) => {
      router.route(
        defineRoute({
          filters: {
            customFilter: ({ detail }: EventBridgeFilterInput): boolean => {
              // @ts-expect-error - detail is unknown, testing filter with known shape
              return detail.orderId === '12345';
            },
          },
          detailSchema: { safeParse: (data: unknown) => ({ success: true as const, data }) },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('does not match route when customFilter returns false', ({ eventBridgeEvent }) => {
      router.route(
        defineRoute({
          filters: {
            customFilter: (): boolean => false,
          },
          detailSchema: { safeParse: (data: unknown) => ({ success: true as const, data }) },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeUndefined();
    });

    test('selects the first matching route when multiple routes match', ({ eventBridgeEvent }) => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();

      router.route(
        defineRoute({
          filters: { sources: ['my.app'] },
        }).handle(firstHandler),
      );
      router.route(
        defineRoute({
          filters: { sources: ['my.app'] },
        }).handle(secondHandler),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeDefined();
      // @ts-expect-error - result is asserted as defined above
      expect(result.handler).toBe(firstHandler);
    });

    test('matches when standard filters and customFilter both pass', ({ eventBridgeEvent }) => {
      router.route(
        defineRoute({
          filters: {
            sources: ['my.app'],
            customFilter: ({ detail }: EventBridgeFilterInput): boolean => {
              // @ts-expect-error - detail is unknown, testing filter with known shape
              return detail.orderId === '12345';
            },
          },
          detailSchema: { safeParse: (data: unknown) => ({ success: true as const, data }) },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('does not match when standard filters pass but customFilter returns false', ({ eventBridgeEvent }) => {
      router.route(
        defineRoute({
          filters: {
            sources: ['my.app'],
            customFilter: (): boolean => false,
          },
          detailSchema: { safeParse: (data: unknown) => ({ success: true as const, data }) },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeUndefined();
    });

    test('matches when event has multiple resources and filter matches one', ({ eventBridgeEvent }) => {
      const arnA = 'arn:aws:ec2:us-east-1:123456789012:instance/i-aaaa';
      const arnB = 'arn:aws:ec2:us-east-1:123456789012:instance/i-bbbb';

      router.route(
        defineRoute({
          filters: { resources: [arnB] },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent({ resources: [arnA, arnB] });
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('passes correct filterInput to customFilter', ({ eventBridgeEvent }) => {
      const customFilter = vi.fn().mockReturnValue(true);

      router.route(
        defineRoute({
          filters: { customFilter },
          detailSchema: { safeParse: (data: unknown) => ({ success: true as const, data }) },
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      // @ts-expect-error - testing private method directly
      router.matchRoute(event);

      expect(customFilter).toHaveBeenCalledWith({
        event,
        source: event.source,
        detailType: event['detail-type'],
        detail: event.detail,
      });
    });
  });

  suite('handleEvent', () => {
    test('calls handler with complete EventBridgeRequest properties', async ({ eventBridgeEvent, context }) => {
      const router = new EventBridgeRouter();
      const handler = vi.fn();
      const definition = defineRoute({
        filters: { sources: ['my.app'] },
      }).handle(handler);
      router.route(definition);

      const event = eventBridgeEvent({
        resources: ['arn:aws:events:us-east-1:123456789012:rule/my-rule'],
      });
      const mockContext = context();
      await router.handleEvent(event, mockContext);

      expect(handler).toHaveBeenCalledWith({
        source: event.source,
        detailType: event['detail-type'],
        detail: event.detail,
        account: event.account,
        region: event.region,
        time: event.time,
        resources: event.resources,
        id: event.id,
        event,
        context: mockContext,
      });
    });

    suite('no route matched', () => {
      test('throws with source and detail-type info for unmatched EventBridge event', async ({
        eventBridgeEvent,
        context,
      }) => {
        const router = createEventBridgeRouter();

        const event = eventBridgeEvent({
          source: 'payment.service',
          'detail-type': 'PaymentFailed',
        });
        await expect(router.handleEvent(event, context())).rejects.toThrow(
          'No route matched for EventBridge event: payment.service / PaymentFailed',
        );
      });
    });
  });

  suite('handleEvent - schema validation', () => {
    test('handler receives validated detail from detailSchema', async ({ eventBridgeEvent, context }) => {
      const router = createEventBridgeRouter();
      const handler = vi.fn();
      const transformedDetail = { orderId: '12345', validated: true };
      const detailSchema: Schema<typeof transformedDetail> = {
        safeParse: () => ({ success: true, data: transformedDetail }),
      };

      router.route(
        defineRoute({
          filters: { sources: ['my.app'] },
          detailSchema,
        }).handle(handler),
      );

      const event = eventBridgeEvent();
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ detail: transformedDetail }));
    });

    test('throws when detailSchema validation fails', async ({ eventBridgeEvent, context }) => {
      const router = createEventBridgeRouter();
      const detailSchema: Schema<unknown> = {
        safeParse: () => ({ success: false, error: new Error('invalid detail') }),
      };

      router.route(
        defineRoute({
          filters: { sources: ['my.app'] },
          detailSchema,
        }).handle(async () => {}),
      );

      const event = eventBridgeEvent();
      await expect(router.handleEvent(event, context())).rejects.toThrow('Detail validation failed for event');
    });
  });

  suite('validateSchema', () => {
    let router: EventBridgeRouter;

    beforeEach(() => {
      router = new EventBridgeRouter();
    });

    test('returns data unchanged when no schema is provided', () => {
      const data = { orderId: '12345' };

      // @ts-expect-error - testing private method directly
      const result = router.validateSchema(data, undefined, 'Error context');

      expect(result).toBe(data);
    });

    test('returns validated data when schema succeeds', () => {
      const data = { orderId: '12345' };
      const transformedData = { orderId: '12345', validated: true };
      const schema: Schema<typeof transformedData> = {
        safeParse: () => ({ success: true, data: transformedData }),
      };

      // @ts-expect-error - testing private method directly
      const result = router.validateSchema(data, schema, 'Error context');

      expect(result).toEqual(transformedData);
    });

    test('throws with error context when schema fails', () => {
      const schema: Schema<unknown> = {
        safeParse: () => ({ success: false, error: new Error('invalid data') }),
      };

      // @ts-expect-error - testing private method directly
      expect(() => router.validateSchema({}, schema, 'Detail validation failed for event abc-123')).toThrow(
        'Detail validation failed for event abc-123',
      );
    });
  });

  suite('full event processing', () => {
    test('routes EventBridge events based on source filters', async ({ eventBridgeEvent, context }) => {
      const receivedOrderRequests: EventBridgeRequest[] = [];
      const receivedPaymentRequests: EventBridgeRequest[] = [];

      const router = createEventBridgeRouter();
      router.route(
        defineRoute({
          filters: { sources: ['order.service'] },
        }).handle(async (request) => {
          receivedOrderRequests.push(request);
        }),
      );
      router.route(
        defineRoute({
          filters: { sources: ['payment.service'] },
        }).handle(async (request) => {
          receivedPaymentRequests.push(request);
        }),
      );

      const event = eventBridgeEvent({ source: 'order.service' });
      const mockContext = context();
      await router.handleEvent(event, mockContext);

      expect(receivedOrderRequests).toHaveLength(1);
      expect(receivedOrderRequests[0]).toEqual(
        expect.objectContaining({
          source: 'order.service',
          detailType: event['detail-type'],
          detail: event.detail,
          id: event.id,
          event,
          context: mockContext,
        }),
      );
      expect(receivedPaymentRequests).toHaveLength(0);
    });

    test('routes events to different handlers based on detailType filters', async ({ eventBridgeEvent, context }) => {
      const orderPlacedHandler = vi.fn();
      const orderShippedHandler = vi.fn();

      const router = createEventBridgeRouter();
      router.route(
        defineRoute({
          filters: { detailTypes: ['OrderPlaced'] },
        }).handle(orderPlacedHandler),
      );
      router.route(
        defineRoute({
          filters: { detailTypes: ['OrderShipped'] },
        }).handle(orderShippedHandler),
      );

      const mockContext = context();
      await router.handleEvent(eventBridgeEvent(), mockContext);
      await router.handleEvent(eventBridgeEvent({ 'detail-type': 'OrderShipped' }), mockContext);

      expect(orderPlacedHandler).toHaveBeenCalledTimes(1);
      expect(orderShippedHandler).toHaveBeenCalledTimes(1);
    });
  });
});
