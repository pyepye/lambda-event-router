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

    test('returns true for an unknown event object', () => {
      const event = createEventBridgeEvent();
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns false for null', () => {
      expect(router.canHandleEvent(null)).toBe(false);
    });

    test('returns false for a string', () => {
      expect(router.canHandleEvent('not an event')).toBe(false);
    });

    test('returns false for a known SQS event', () => {
      const event = { Records: [{ eventSource: 'aws:sqs' }] };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known SNS event', () => {
      const event = { Records: [{ EventSource: 'aws:sns' }] };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known S3 event', () => {
      const event = { Records: [{ eventSource: 'aws:s3' }] };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known DynamoDB Stream event', () => {
      const event = { Records: [{ eventSource: 'aws:dynamodb' }] };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known Kinesis event', () => {
      const event = { Records: [{ eventSource: 'aws:kinesis' }] };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known API Gateway V2 event', () => {
      const event = { rawPath: '/test', requestContext: { http: { method: 'GET' } } };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known Cognito event', () => {
      const event = { triggerSource: 'PreSignUp_SignUp', userPoolId: 'us-east-1_TestPool' };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns true for Records array with non-object first element', () => {
      const event = { Records: [42] };
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns true for Records array with unknown eventSource string', () => {
      const event = { Records: [{ eventSource: 'aws:unknown' }] };
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns true for Records array with non-string eventSource', () => {
      const event = { Records: [{ eventSource: 123 }] };
      expect(router.canHandleEvent(event)).toBe(true);
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

    test('preserves filters, eventSchema, and handler in Scheduler definition', () => {
      const eventSchema: Schema<{ taskId: string }> = {
        safeParse: (data: unknown) => ({ success: true, data: data as { taskId: string } }),
      };
      const handler = vi.fn();
      const filters = { customFilter: () => true };

      const definition = defineRoute({
        filters,
        eventSchema,
      }).handle(handler);

      expect(definition).toEqual({
        filters,
        eventSchema,
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

  suite('isSchedulerRouteDefinition', () => {
    let router: EventBridgeRouter;

    beforeEach(() => {
      router = new EventBridgeRouter();
    });

    test('returns true when definition has eventSchema', () => {
      const definition = defineRoute({
        filters: {},
        eventSchema: { safeParse: () => ({ success: true as const, data: {} }) },
      }).handle(async () => {});

      // @ts-expect-error - testing private method directly
      expect(router.isSchedulerRouteDefinition(definition)).toBe(true);
    });

    test('returns false when definition has detailSchema', () => {
      const definition = defineRoute({
        filters: { sources: ['my.app'] },
        detailSchema: { safeParse: () => ({ success: true as const, data: {} }) },
      }).handle(async () => {});

      // @ts-expect-error - testing private method directly
      expect(router.isSchedulerRouteDefinition(definition)).toBe(false);
    });

    it.each([
      { filterName: 'sources', filters: { sources: ['my.app'] } },
      { filterName: 'detailTypes', filters: { detailTypes: ['OrderPlaced'] } },
      { filterName: 'accounts', filters: { accounts: ['123456789012'] } },
      { filterName: 'regions', filters: { regions: ['us-east-1'] } },
      {
        filterName: 'resources',
        filters: { resources: ['arn:aws:ec2:us-east-1:123456789012:instance/i-1234567890abcdef0'] },
      },
    ])('returns false when definition has $filterName filter', ({ filters }) => {
      const definition = defineRoute({ filters }).handle(async () => {});

      // @ts-expect-error - testing private method directly
      expect(router.isSchedulerRouteDefinition(definition)).toBe(false);
    });

    test('returns true when definition has no schema and no standard filters', () => {
      const definition = defineRoute({
        filters: {},
      }).handle(async () => {});

      // @ts-expect-error - testing private method directly
      expect(router.isSchedulerRouteDefinition(definition)).toBe(true);
    });

    suite('with hand-crafted definitions (no schema properties)', () => {
      it.each([
        { filterName: 'sources', filters: { sources: ['my.app'] } },
        { filterName: 'detailTypes', filters: { detailTypes: ['OrderPlaced'] } },
        { filterName: 'accounts', filters: { accounts: ['123456789012'] } },
        { filterName: 'regions', filters: { regions: ['us-east-1'] } },
        {
          filterName: 'resources',
          filters: { resources: ['arn:aws:ec2:us-east-1:123456789012:instance/i-1234567890abcdef0'] },
        },
      ])('returns false when definition has $filterName filter and no schema', ({ filters }) => {
        const definition = { filters, handler: async () => {} };

        // @ts-expect-error - testing private method with hand-crafted definition
        expect(router.isSchedulerRouteDefinition(definition)).toBe(false);
      });

      test('returns true when definition has no schema and no standard filters', () => {
        const definition = { filters: {}, handler: async () => {} };

        // @ts-expect-error - testing private method with hand-crafted definition
        expect(router.isSchedulerRouteDefinition(definition)).toBe(true);
      });
    });
  });

  suite('matchRoute', () => {
    let router: EventBridgeRouter;

    beforeEach(() => {
      router = createEventBridgeRouter();
    });

    suite('with EventBridge envelope', () => {
      test('matches route by sources filter', ({ eventBridgeEvent }) => {
        router.route(
          defineRoute({
            filters: { sources: ['my.app'] },
          }).handle(async () => {}),
        );

        const event = eventBridgeEvent();
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(event, event);

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
        const result = router.matchRoute(event, event);

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
        const result = router.matchRoute(event, event);

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
        const result = router.matchRoute(event, event);

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
        const result = router.matchRoute(event, event);

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
        const result = router.matchRoute(event, event);

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
        const result = router.matchRoute(event, event);

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
        const result = router.matchRoute(event, event);

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
        const result = router.matchRoute(event, event);

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
        const result = router.matchRoute(event, event);

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
        const result = router.matchRoute(event, event);

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
        const result = router.matchRoute(event, event);

        expect(result).toBeUndefined();
      });

      test('matches route by customFilter with envelope', ({ eventBridgeEvent }) => {
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
        const result = router.matchRoute(event, event);

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
        const result = router.matchRoute(event, event);

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
        const result = router.matchRoute(event, event);

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
        const result = router.matchRoute(event, event);

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
        const result = router.matchRoute(event, event);

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
        const result = router.matchRoute(event, event);

        expect(result).toBeDefined();
      });

      test('passes correct filterInput to customFilter with envelope', ({ eventBridgeEvent }) => {
        const customFilter = vi.fn().mockReturnValue(true);

        router.route(
          defineRoute({
            filters: { customFilter },
            detailSchema: { safeParse: (data: unknown) => ({ success: true as const, data }) },
          }).handle(async () => {}),
        );

        const event = eventBridgeEvent();
        // @ts-expect-error - testing private method directly
        router.matchRoute(event, event);

        expect(customFilter).toHaveBeenCalledWith({
          event,
          source: event.source,
          detailType: event['detail-type'],
          detail: event.detail,
        });
      });
    });

    suite('without envelope', () => {
      test('does not match when route has standard filters and no envelope', () => {
        router.route(
          defineRoute({
            filters: { sources: ['my.app'] },
          }).handle(async () => {}),
        );

        const event = { taskId: 'task-123' };
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(event, undefined);

        expect(result).toBeUndefined();
      });

      test('matches route with customFilter only and no envelope', () => {
        router.route(
          defineRoute({
            filters: {
              customFilter: ({ event }: EventBridgeFilterInput): boolean => {
                // @ts-expect-error - event is unknown, testing filter with known shape
                return event.taskId === 'task-123';
              },
            },
            eventSchema: { safeParse: (data: unknown) => ({ success: true as const, data }) },
          }).handle(async () => {}),
        );

        const event = { taskId: 'task-123' };
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(event, undefined);

        expect(result).toBeDefined();
      });

      test('does not match when customFilter returns false and no envelope', () => {
        router.route(
          defineRoute({
            filters: {
              customFilter: (): boolean => false,
            },
            eventSchema: { safeParse: (data: unknown) => ({ success: true as const, data }) },
          }).handle(async () => {}),
        );

        const event = { taskId: 'task-123' };
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(event, undefined);

        expect(result).toBeUndefined();
      });

      test('matches route with empty filters as catch-all and no envelope', () => {
        router.route(
          defineRoute({
            filters: {},
          }).handle(async () => {}),
        );

        const event = { taskId: 'task-123' };
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(event, undefined);

        expect(result).toBeDefined();
      });

      test('passes correct filterInput to customFilter without envelope', () => {
        const customFilter = vi.fn().mockReturnValue(true);

        router.route(
          defineRoute({
            filters: { customFilter },
            eventSchema: { safeParse: (data: unknown) => ({ success: true as const, data }) },
          }).handle(async () => {}),
        );

        const event = { taskId: 'task-123' };
        // @ts-expect-error - testing private method directly
        router.matchRoute(event, undefined);

        expect(customFilter).toHaveBeenCalledWith({
          event,
          source: undefined,
          detailType: undefined,
          detail: undefined,
        });
      });
    });
  });

  suite('handleEvent', () => {
    suite('EventBridge routes', () => {
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

      test('throws when route expects EventBridge event but receives non-envelope event', async ({ context }) => {
        const router = new EventBridgeRouter();
        router.route(
          defineRoute({
            filters: {
              customFilter: (): boolean => true,
            },
            detailSchema: { safeParse: (data: unknown) => ({ success: true as const, data }) },
          }).handle(async () => {}),
        );

        const nonEnvelopeEvent = { taskId: 'task-123' };
        await expect(router.handleEvent(nonEnvelopeEvent, context())).rejects.toThrow(
          'Route expects standard EventBridge event but received different format',
        );
      });
    });

    suite('Scheduler routes', () => {
      test('calls scheduler handler with the raw event', async ({ context }) => {
        const router = new EventBridgeRouter();
        const handler = vi.fn();
        const schedulerEvent = { taskId: 'task-123', payload: 'data' };

        router.route(
          defineRoute({
            filters: {},
            eventSchema: { safeParse: (data: unknown) => ({ success: true as const, data }) },
          }).handle(handler),
        );

        await router.handleEvent(schedulerEvent, context());

        expect(handler).toHaveBeenCalledWith(schedulerEvent);
      });

      test('calls scheduler handler with EventBridge envelope event', async ({ eventBridgeEvent, context }) => {
        const router = new EventBridgeRouter();
        const handler = vi.fn();

        router.route(
          defineRoute({
            filters: {},
            eventSchema: { safeParse: (data: unknown) => ({ success: true as const, data }) },
          }).handle(handler),
        );

        const event = eventBridgeEvent();
        await router.handleEvent(event, context());

        expect(handler).toHaveBeenCalledWith(event);
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

      test('throws generic error for unmatched non-envelope event', async ({ context }) => {
        const router = createEventBridgeRouter();

        await expect(router.handleEvent({ taskId: 'task-123' }, context())).rejects.toThrow(
          'No route matched for event',
        );
      });

      test('throws generic error for non-object event', async ({ context }) => {
        const router = createEventBridgeRouter();

        await expect(router.handleEvent('not-an-object', context())).rejects.toThrow('No route matched for event');
      });
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

  suite('handleEvent - schema validation', () => {
    suite('EventBridge detailSchema', () => {
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

    suite('Scheduler eventSchema', () => {
      test('handler receives validated event from eventSchema', async ({ context }) => {
        const router = createEventBridgeRouter();
        const handler = vi.fn();
        const transformedEvent = { taskId: 'task-123', validated: true };
        const eventSchema: Schema<typeof transformedEvent> = {
          safeParse: () => ({ success: true, data: transformedEvent }),
        };

        router.route(
          defineRoute({
            filters: {},
            eventSchema,
          }).handle(handler),
        );

        await router.handleEvent({ taskId: 'task-123' }, context());

        expect(handler).toHaveBeenCalledWith(transformedEvent);
      });

      test('throws when eventSchema validation fails', async ({ context }) => {
        const router = createEventBridgeRouter();
        const eventSchema: Schema<unknown> = {
          safeParse: () => ({ success: false, error: new Error('invalid event') }),
        };

        router.route(
          defineRoute({
            filters: {},
            eventSchema,
          }).handle(async () => {}),
        );

        await expect(router.handleEvent({ taskId: 'task-123' }, context())).rejects.toThrow(
          'Scheduler event validation failed',
        );
      });
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

    test('routes scheduler and EventBridge events through the same router', async ({ eventBridgeEvent, context }) => {
      const eventBridgeHandler = vi.fn();
      const schedulerHandler = vi.fn();

      const router = createEventBridgeRouter();
      router.route(
        defineRoute({
          filters: { sources: ['order.service'] },
        }).handle(eventBridgeHandler),
      );
      router.route(
        defineRoute({
          filters: {
            customFilter: ({ event }: EventBridgeFilterInput): boolean => {
              // @ts-expect-error - event is unknown, testing filter with known shape
              return event.taskId !== undefined;
            },
          },
          eventSchema: { safeParse: (data: unknown) => ({ success: true as const, data }) },
        }).handle(schedulerHandler),
      );

      const mockContext = context();

      const ebEvent = eventBridgeEvent({ source: 'order.service' });
      await router.handleEvent(ebEvent, mockContext);

      const schedulerEvent = { taskId: 'task-456' };
      await router.handleEvent(schedulerEvent, mockContext);

      expect(eventBridgeHandler).toHaveBeenCalledTimes(1);
      expect(schedulerHandler).toHaveBeenCalledTimes(1);
      expect(schedulerHandler).toHaveBeenCalledWith(schedulerEvent);
    });
  });
});
