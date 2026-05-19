import type { Context } from 'aws-lambda';

import type { MockInstance } from 'vitest';

import * as base from '@lambda-event-router/base';
import { createMockContext, createMockSchema } from '@lambda-event-router/testing';

import { createStepFunctionsRouter, defineRoute, StepFunctionsRouter } from './StepFunctionsRouter.js';
import type { StepFunctionsFilterInput, StepFunctionsMiddleware, StepFunctionsRequest } from './types.js';

type StepFunctionsNext = (request: StepFunctionsRequest) => Promise<unknown>;

const validateSchemaSpy: MockInstance = vi.spyOn(base, 'validateSchema');

const context: Context = createMockContext();

suite('StepFunctionsRouter', () => {
  let router: StepFunctionsRouter;

  beforeEach(() => {
    router = new StepFunctionsRouter();
  });

  suite('createStepFunctionsRouter', () => {
    test('creates a StepFunctionsRouter instance', () => {
      const router = createStepFunctionsRouter();
      expect(router).toBeInstanceOf(StepFunctionsRouter);
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for a plain object event', () => {
      expect(router.canHandleEvent({ action: 'process', data: 123 })).toBe(true);
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

    test('returns false for undefined', () => {
      expect(router.canHandleEvent(undefined)).toBe(false);
    });

    test('returns false for a number', () => {
      expect(router.canHandleEvent(42)).toBe(false);
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

    test('returns false for a known DynamoDB event', () => {
      const event = { Records: [{ eventSource: 'aws:dynamodb' }] };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known Kinesis event', () => {
      const event = { Records: [{ eventSource: 'aws:kinesis' }] };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for an API Gateway V2 event', () => {
      const event = { rawPath: '/api/users', requestContext: { http: {} } };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a Cognito event', () => {
      const event = { triggerSource: 'PreSignUp_SignUp', userPoolId: 'us-east-1_abc123' };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for an EventBridge event', () => {
      const event = { source: 'custom.app', 'detail-type': 'OrderCreated', detail: { orderId: '123' } };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns true for an empty Records array', () => {
      expect(router.canHandleEvent({ Records: [] })).toBe(true);
    });

    test('returns true when Records contains a non-object element', () => {
      expect(router.canHandleEvent({ Records: ['not-an-object'] })).toBe(true);
    });

    test('returns true for an unknown eventSource in Records', () => {
      const event = { Records: [{ eventSource: 'custom:source' }] };
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns true when eventSource is not a string', () => {
      const event = { Records: [{ eventSource: 123 }] };
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns true for an empty object', () => {
      expect(router.canHandleEvent({})).toBe(true);
    });

    test('returns true for an object with TaskToken', () => {
      const event = { TaskToken: 'abc-123', input: { action: 'process' } };
      expect(router.canHandleEvent(event)).toBe(true);
    });
  });

  suite('defineRoute', () => {
    test('returns a route builder with a handle method', () => {
      const builder = defineRoute({
        filters: {},
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });

    test('preserves filters, eventSchema, and handler in a regular route definition', () => {
      const eventSchema = createMockSchema();
      const handler = vi.fn();
      const filters = {
        custom: () => true,
      };

      const definition = defineRoute({
        filters,
        eventSchema,
      }).handle(handler);

      expect(definition.filters).toEqual(filters);
      expect(definition.eventSchema).toBe(eventSchema);
      expect(definition.handler).toBe(handler);
    });

    test('preserves filters, eventSchema, and handler in a task token route definition', () => {
      const eventSchema = createMockSchema();
      const handler = vi.fn();
      const filters = {
        taskToken: true as const,
      };

      const definition = defineRoute({
        filters,
        eventSchema,
      }).handle(handler);

      expect(definition.filters).toEqual(filters);
      expect(definition.eventSchema).toBe(eventSchema);
      expect(definition.handler).toBe(handler);
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

  suite('matchRoute', () => {
    test('matches a route with taskToken filter when event has a TaskToken string', async () => {
      router.route(
        defineRoute({
          filters: { taskToken: true },
        }).handle(async () => {}),
      );

      const event = { TaskToken: 'token-abc', data: 'payload' };
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('does not match a taskToken route when TaskToken is missing', async () => {
      router.route(
        defineRoute({
          filters: { taskToken: true },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ data: 'no-token' });

      expect(result).toBeUndefined();
    });

    test('does not match a taskToken route when TaskToken is not a string', async () => {
      router.route(
        defineRoute({
          filters: { taskToken: true },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ TaskToken: 123 });

      expect(result).toBeUndefined();
    });

    test('does not match a taskToken route when event is not an object', async () => {
      router.route(
        defineRoute({
          filters: { taskToken: true },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute('not-an-object');

      expect(result).toBeUndefined();
    });

    test('matches a route by custom', async () => {
      router.route(
        defineRoute({
          filters: {
            custom: ({ event }: StepFunctionsFilterInput): boolean => {
              // @ts-expect-error - event is unknown, testing filter with known shape
              return event.action === 'process';
            },
          },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ action: 'process' });

      expect(result).toBeDefined();
    });

    test('matches a route by async custom', async () => {
      router.route(
        defineRoute({
          filters: {
            custom: async ({ event }: StepFunctionsFilterInput): Promise<boolean> => {
              await new Promise((r) => setTimeout(r, 1));
              // @ts-expect-error - event is unknown, testing filter with known shape
              return event.action === 'process';
            },
          },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ action: 'process' });

      expect(result).toBeDefined();
    });

    test('does not match when custom returns false', async () => {
      router.route(
        defineRoute({
          filters: { custom: () => false },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ action: 'process' });

      expect(result).toBeUndefined();
    });

    test('passes { event } to the custom', async () => {
      const custom = vi.fn(() => true);
      router.route(
        defineRoute({
          filters: { custom },
        }).handle(async () => {}),
      );

      const event = { action: 'test' };
      // @ts-expect-error - testing private method directly
      router.matchRoute(event);

      expect(custom).toHaveBeenCalledWith({ event });
    });

    test('matches a catch-all route with empty filters', async () => {
      router.route(
        defineRoute({
          filters: {},
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ anything: 'goes' });

      expect(result).toBeDefined();
    });

    test('matches a taskToken route with custom when both conditions are met', async () => {
      router.route(
        defineRoute({
          filters: {
            taskToken: true,
            custom: ({ event }: StepFunctionsFilterInput) => {
              // @ts-expect-error - event is unknown, testing filter with known shape
              return event.action === 'approve';
            },
          },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ TaskToken: 'token-1', action: 'approve' });

      expect(result).toBeDefined();
    });

    test('does not match a taskToken route with custom when custom returns false', async () => {
      router.route(
        defineRoute({
          filters: {
            taskToken: true,
            custom: () => false,
          },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ TaskToken: 'token-1', action: 'reject' });

      expect(result).toBeUndefined();
    });

    test('does not match a taskToken route with custom when TaskToken is missing', async () => {
      router.route(
        defineRoute({
          filters: {
            taskToken: true,
            custom: () => true,
          },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ action: 'approve' });

      expect(result).toBeUndefined();
    });

    test('selects the first matching route when multiple routes match', async () => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();
      router.route(defineRoute({ filters: {} }).handle(firstHandler));
      router.route(defineRoute({ filters: {} }).handle(secondHandler));

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ data: 'test' });

      expect(result).toBeDefined();
      expect(result?.handler).toBe(firstHandler);
    });

    test('returns undefined when no routes are registered', async () => {
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ data: 'test' });

      expect(result).toBeUndefined();
    });
  });

  suite('handleEvent', () => {
    test('calls the matched handler with the event and returns the result', async () => {
      const handler = vi.fn().mockResolvedValue({ status: 'done' });
      router.route(defineRoute({ filters: {} }).handle(handler));

      const event = { action: 'process', orderId: '123' };
      const result = await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith({ event, context });
      expect(result).toEqual({ status: 'done' });
    });

    test('throws when no route matches', async () => {
      await expect(router.handleEvent({ action: 'unknown' }, context)).rejects.toThrow(
        'No route matched for Step Functions event',
      );
    });

    test('throws a NoRouteMatchedError when no route matches', async () => {
      const error = await router.handleEvent({ action: 'unknown' }, context).catch((thrown: unknown) => thrown);

      expect(base.NoRouteMatchedError.isNoRouteMatchedError(error)).toBe(true);
    });

    test('extracts TaskToken and passes { taskToken, input } to a task token handler', async () => {
      const handler = vi.fn().mockResolvedValue({ sent: true });
      router.route(
        defineRoute({
          filters: { taskToken: true },
        }).handle(handler),
      );

      const event = { TaskToken: 'token-xyz', orderId: '456', status: 'approved' };
      const result = await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith({
        taskToken: 'token-xyz',
        input: { orderId: '456', status: 'approved' },
        event,
        context,
      });
      expect(result).toEqual({ sent: true });
    });

    test('propagates handler errors', async () => {
      router.route(
        defineRoute({ filters: {} }).handle(async () => {
          throw new Error('handler exploded');
        }),
      );

      await expect(router.handleEvent({ data: 'test' }, context)).rejects.toThrow('handler exploded');
    });
  });

  suite('handleEvent - schema validation', () => {
    test('handler receives validated event from eventSchema for a regular route', async () => {
      const handler = vi.fn();
      const eventSchema = createMockSchema();
      router.route(
        defineRoute({
          filters: {},
          eventSchema,
        }).handle(handler),
      );

      const rawEvent = { action: 'process' };
      await router.handleEvent(rawEvent, context);

      expect(validateSchemaSpy).toHaveBeenCalledWith(rawEvent, eventSchema, expect.any(String));
      expect(handler).toHaveBeenCalledWith({ event: rawEvent, context });
    });

    test('throws when eventSchema validation fails for a regular route', async () => {
      const eventSchema = createMockSchema({ issues: [{ message: 'invalid' }] });
      router.route(
        defineRoute({
          filters: {},
          eventSchema,
        }).handle(async () => {}),
      );

      const rawEvent = { bad: 'data' };
      await expect(router.handleEvent(rawEvent, context)).rejects.toThrow('Event validation failed');
    });

    test('passes raw event to handler when no eventSchema is provided', async () => {
      const handler = vi.fn();
      router.route(defineRoute({ filters: {} }).handle(handler));

      const event = { action: 'process', raw: true };
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith({ event, context });
    });

    test('validates input (not TaskToken) with eventSchema for a task token route', async () => {
      const handler = vi.fn();
      const eventSchema = createMockSchema();
      router.route(
        defineRoute({
          filters: { taskToken: true },
          eventSchema,
        }).handle(handler),
      );

      const rawEvent = { TaskToken: 'token-abc', orderId: '123' };
      await router.handleEvent(rawEvent, context);

      expect(validateSchemaSpy).toHaveBeenCalledWith({ orderId: '123' }, eventSchema, expect.any(String));
      expect(handler).toHaveBeenCalledWith({
        taskToken: 'token-abc',
        input: { orderId: '123' },
        event: rawEvent,
        context,
      });
    });

    test('throws when eventSchema validation fails for a task token route', async () => {
      const eventSchema = createMockSchema({ issues: [{ message: 'invalid input' }] });
      router.route(
        defineRoute({
          filters: { taskToken: true },
          eventSchema,
        }).handle(async () => {}),
      );

      await expect(router.handleEvent({ TaskToken: 'token-abc', bad: 'data' }, context)).rejects.toThrow(
        'Event validation failed',
      );
    });
  });

  suite('full event processing', () => {
    test('routes to different handlers via custom', async () => {
      const createHandler = vi.fn();
      const deleteHandler = vi.fn();
      router.route(
        defineRoute({
          filters: {
            custom: ({ event }: StepFunctionsFilterInput) => {
              // @ts-expect-error - event is unknown, testing filter with known shape
              return event.action === 'create';
            },
          },
        }).handle(createHandler),
      );
      router.route(
        defineRoute({
          filters: {
            custom: ({ event }: StepFunctionsFilterInput) => {
              // @ts-expect-error - event is unknown, testing filter with known shape
              return event.action === 'delete';
            },
          },
        }).handle(deleteHandler),
      );

      await router.handleEvent({ action: 'create', id: '1' }, context);
      await router.handleEvent({ action: 'delete', id: '2' }, context);

      expect(createHandler).toHaveBeenCalledTimes(1);
      expect(createHandler).toHaveBeenCalledWith({ event: { action: 'create', id: '1' }, context });
      expect(deleteHandler).toHaveBeenCalledTimes(1);
      expect(deleteHandler).toHaveBeenCalledWith({ event: { action: 'delete', id: '2' }, context });
    });

    test('same router handles both task token and regular events', async () => {
      const taskTokenHandler = vi.fn().mockResolvedValue({ sent: true });
      const regularHandler = vi.fn().mockResolvedValue({ processed: true });
      router.route(
        defineRoute({
          filters: { taskToken: true },
        }).handle(taskTokenHandler),
      );
      router.route(
        defineRoute({
          filters: {},
        }).handle(regularHandler),
      );

      const taskTokenResult = await router.handleEvent({ TaskToken: 'token-1', orderId: '100' }, context);
      const regularResult = await router.handleEvent({ action: 'process', orderId: '200' }, context);

      expect(taskTokenHandler).toHaveBeenCalledWith({
        taskToken: 'token-1',
        input: { orderId: '100' },
        event: { TaskToken: 'token-1', orderId: '100' },
        context,
      });
      expect(taskTokenResult).toEqual({ sent: true });

      expect(regularHandler).toHaveBeenCalledWith({ event: { action: 'process', orderId: '200' }, context });
      expect(regularResult).toEqual({ processed: true });
    });

    test('catch-all handles non-matching events', async () => {
      const specificHandler = vi.fn();
      const catchAllHandler = vi.fn().mockResolvedValue({ fallback: true });
      router.route(
        defineRoute({
          filters: {
            custom: ({ event }: StepFunctionsFilterInput) => {
              // @ts-expect-error - event is unknown, testing filter with known shape
              return event.action === 'specific';
            },
          },
        }).handle(specificHandler),
      );
      router.route(
        defineRoute({
          filters: {},
        }).handle(catchAllHandler),
      );

      const result = await router.handleEvent({ action: 'unknown' }, context);

      expect(specificHandler).not.toHaveBeenCalled();
      expect(catchAllHandler).toHaveBeenCalledWith({ event: { action: 'unknown' }, context });
      expect(result).toEqual({ fallback: true });
    });
  });

  suite('context', () => {
    test('passes the Lambda context to a regular handler', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      router.route(defineRoute({ filters: {} }).handle(handler));

      await router.handleEvent({ action: 'process' }, context);

      expect(handler.mock.calls[0]?.[0].context).toBe(context);
    });

    test('passes the Lambda context to a task token handler', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      router.route(defineRoute({ filters: { taskToken: true } }).handle(handler));

      await router.handleEvent({ TaskToken: 'token-abc', orderId: '1' }, context);

      expect(handler.mock.calls[0]?.[0].context).toBe(context);
    });
  });

  suite('middleware', () => {
    function trace(name: string, calls: string[]): StepFunctionsMiddleware {
      return async function tracer(request: StepFunctionsRequest, next: StepFunctionsNext): Promise<unknown> {
        calls.push(`${name}-pre`);
        const result = await next(request);
        calls.push(`${name}-post`);
        return result;
      };
    }

    test('runs router middleware then route middleware around the handler', async () => {
      const calls: string[] = [];
      const routerLevel = createStepFunctionsRouter({ middleware: [trace('router', calls)] });
      routerLevel.route(
        defineRoute({ filters: {}, middleware: [trace('route', calls)] }).handle(async () => {
          calls.push('handler');
          return { done: true };
        }),
      );

      const result = await routerLevel.handleEvent({ action: 'process' }, context);

      expect(calls).toEqual(['router-pre', 'route-pre', 'handler', 'route-post', 'router-post']);
      expect(result).toEqual({ done: true });
    });

    test('runs middleware for a task token route as well', async () => {
      const calls: string[] = [];
      const routerLevel = createStepFunctionsRouter({ middleware: [trace('router', calls)] });
      routerLevel.route(
        defineRoute({ filters: { taskToken: true } }).handle(async () => {
          calls.push('handler');
        }),
      );

      await routerLevel.handleEvent({ TaskToken: 'token-abc', orderId: '1' }, context);

      expect(calls).toEqual(['router-pre', 'handler', 'router-post']);
    });

    test('gives middleware the event and context, and lets it read the request', async () => {
      const seen: unknown[] = [];
      async function record(request: StepFunctionsRequest, next: StepFunctionsNext): Promise<unknown> {
        seen.push({ event: request.event, context: request.context });
        return next(request);
      }

      const routerLevel = createStepFunctionsRouter({ middleware: [record] });
      routerLevel.route(defineRoute({ filters: {} }).handle(async () => undefined));

      await routerLevel.handleEvent({ action: 'process' }, context);

      expect(seen).toEqual([{ event: { action: 'process' }, context }]);
    });

    test('lets middleware short-circuit without calling the handler', async () => {
      const handler = vi.fn();
      async function block(): Promise<unknown> {
        return { blocked: true };
      }

      const routerLevel = createStepFunctionsRouter({ middleware: [block] });
      routerLevel.route(defineRoute({ filters: {} }).handle(handler));

      const result = await routerLevel.handleEvent({ action: 'process' }, context);

      expect(result).toEqual({ blocked: true });
      expect(handler).not.toHaveBeenCalled();
    });

    test('runs no middleware when none is registered', async () => {
      const handler = vi.fn().mockResolvedValue({ done: true });
      router.route(defineRoute({ filters: {} }).handle(handler));

      await expect(router.handleEvent({ action: 'process' }, context)).resolves.toEqual({ done: true });
    });
  });
});
