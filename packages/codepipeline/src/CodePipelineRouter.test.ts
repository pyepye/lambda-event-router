import type { Mock, MockInstance } from 'vitest';

import * as base from '@lambda-event-router/base';
import { createCodePipelineEvent, createMockSchema, test } from '@lambda-event-router/testing';

import { CodePipelineRouter, createCodePipelineRouter, defineRoute } from './CodePipelineRouter.js';
import type { CodePipelineFilterInput, CodePipelineRequest, CodePipelineResponse } from './types.js';

type CodePipelineNext = (request: CodePipelineRequest) => Promise<CodePipelineResponse>;

const validateSchemaSpy: MockInstance = vi.spyOn(base, 'validateSchema');
const safeJsonParseSpy: MockInstance = vi.spyOn(base, 'safeJsonParse');

const mockSend: Mock = vi.hoisted(() => vi.fn());

vi.mock('@aws-sdk/client-codepipeline', () => {
  return {
    CodePipelineClient: class {
      send = mockSend;
    },
    PutJobSuccessResultCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
    PutJobFailureResultCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
  };
});

function getSentCommand(callIndex: number = 0): { input: unknown } {
  const call = mockSend.mock.calls[callIndex];
  if (!call) throw new Error(`No mock.send call at index ${callIndex}`);
  return call[0];
}

suite('CodePipelineRouter', () => {
  let router: CodePipelineRouter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({});
    router = new CodePipelineRouter();
  });

  suite('createCodePipelineRouter', () => {
    test('creates a CodePipelineRouter instance', () => {
      const router = createCodePipelineRouter();
      expect(router).toBeInstanceOf(CodePipelineRouter);
    });

    test('ucodePipeline custom CodePipelineClient when provided', async ({ codePipelineHandlerEvent }) => {
      const customSend = vi.fn().mockResolvedValue({});
      const customClient = { send: customSend };

      // @ts-expect-error - partial CodePipelineClient mock with only the send method needed
      const router = createCodePipelineRouter({ client: customClient });
      router.route(defineRoute({ filters: {} }).handle(async () => undefined));

      const { event, context } = codePipelineHandlerEvent({ event: { id: 'custom-client-job' } });
      await router.handleEvent(event, context);

      expect(customSend).toHaveBeenCalledOnce();
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for a valid CodePipeline event', () => {
      const event = createCodePipelineEvent();
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns false for null', () => {
      expect(router.canHandleEvent(null)).toBe(false);
    });

    test('returns false for a string', () => {
      expect(router.canHandleEvent('not an event')).toBe(false);
    });

    test('returns false for a number', () => {
      expect(router.canHandleEvent(42)).toBe(false);
    });

    test('returns false for an array', () => {
      expect(router.canHandleEvent([1, 2, 3])).toBe(false);
    });

    test('returns false when CodePipeline.job is missing', () => {
      expect(router.canHandleEvent({ other: 'data' })).toBe(false);
    });

    test('returns false when CodePipeline.job is not an object', () => {
      expect(router.canHandleEvent({ 'CodePipeline.job': 'not-an-object' })).toBe(false);
    });

    test('returns false when job id is missing', () => {
      expect(router.canHandleEvent({ 'CodePipeline.job': { data: {} } })).toBe(false);
    });

    test('returns false when job id is not a string', () => {
      expect(router.canHandleEvent({ 'CodePipeline.job': { id: 123, data: {} } })).toBe(false);
    });

    test('returns false when job data is missing', () => {
      expect(router.canHandleEvent({ 'CodePipeline.job': { id: 'job-1' } })).toBe(false);
    });

    test('returns false when job data is not an object', () => {
      expect(router.canHandleEvent({ 'CodePipeline.job': { id: 'job-1', data: 'not-an-object' } })).toBe(false);
    });
  });

  suite('defineRoute', () => {
    test('returns a builder with a handle method', () => {
      const builder = defineRoute({
        filters: { functionName: 'my-function' },
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });

    test('preserves filters, userParametersSchema, and handler in the definition', () => {
      const handler = vi.fn();
      const filters = { functionName: 'my-function' };
      const userParametersSchema = createMockSchema();

      const definition = defineRoute({ filters, userParametersSchema }).handle(handler);

      expect(definition.filters).toEqual(filters);
      expect(definition.userParametersSchema).toBe(userParametersSchema);
      expect(definition.handler).toBe(handler);
    });
  });

  suite('route', () => {
    test('returns the router instance for chaining', () => {
      const definition = defineRoute({
        filters: { functionName: 'my-function' },
      }).handle(async () => undefined);

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  suite('continuation', () => {
    test('returns the router instance for chaining', () => {
      const result = router.continuation({
        filters: {},
        handler: async () => undefined,
      });

      expect(result).toBe(router);
    });

    test('sets hasContinuationToken to true in filters', async () => {
      const handler = vi.fn();

      router.continuation({
        filters: { functionName: 'my-function' },
        handler,
      });

      const filterInput: CodePipelineFilterInput = {
        functionName: 'my-function',
        userParameters: '',
        hasInputArtifacts: false,
        hasContinuationToken: true,
      };

      // @ts-expect-error - testing private method directly
      const matched = await router.matchRoute(filterInput);
      expect(matched).toBeDefined();

      const filterInputWithoutToken: CodePipelineFilterInput = {
        ...filterInput,
        hasContinuationToken: false,
      };

      // @ts-expect-error - testing private method directly
      const notMatched = await router.matchRoute(filterInputWithoutToken);
      expect(notMatched).toBeUndefined();
    });
  });

  suite('matchRoute', () => {
    let filterInput: CodePipelineFilterInput;

    beforeEach(() => {
      filterInput = {
        functionName: 'my-function',
        userParameters: '',
        hasInputArtifacts: false,
        hasContinuationToken: false,
      };
    });

    test('matches when no filters are set', async () => {
      router.route(defineRoute({ filters: {} }).handle(async () => undefined));

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(filterInput);
      expect(result).toBeDefined();
    });

    test('matches by functionName', async () => {
      router.route(defineRoute({ filters: { functionName: 'my-function' } }).handle(async () => undefined));

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(filterInput);
      expect(result).toBeDefined();
    });

    test('matches by functionName array', async () => {
      router.route(
        defineRoute({ filters: { functionName: ['my-function', 'other-function'] } }).handle(async () => undefined),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(filterInput);
      expect(result).toBeDefined();
    });

    test('rejects when functionName does not match', async () => {
      router.route(defineRoute({ filters: { functionName: 'other-function' } }).handle(async () => undefined));

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(filterInput);
      expect(result).toBeUndefined();
    });

    test('matches by hasInputArtifacts true', async () => {
      router.route(defineRoute({ filters: { hasInputArtifacts: true } }).handle(async () => undefined));

      const filterInput: CodePipelineFilterInput = {
        functionName: 'my-function',
        userParameters: '',
        hasInputArtifacts: true,
        hasContinuationToken: false,
      };

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(filterInput);
      expect(result).toBeDefined();
    });

    test('rejects when hasInputArtifacts does not match', async () => {
      router.route(defineRoute({ filters: { hasInputArtifacts: true } }).handle(async () => undefined));

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(filterInput);
      expect(result).toBeUndefined();
    });

    test('matches by hasInputArtifacts false', async () => {
      router.route(defineRoute({ filters: { hasInputArtifacts: false } }).handle(async () => undefined));

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(filterInput);
      expect(result).toBeDefined();
    });

    test('matches by hasContinuationToken true', async () => {
      router.route(defineRoute({ filters: { hasContinuationToken: true } }).handle(async () => undefined));

      const filterInput: CodePipelineFilterInput = {
        functionName: 'my-function',
        userParameters: '',
        hasInputArtifacts: false,
        hasContinuationToken: true,
      };

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(filterInput);
      expect(result).toBeDefined();
    });

    test('rejects when hasContinuationToken does not match', async () => {
      router.route(defineRoute({ filters: { hasContinuationToken: true } }).handle(async () => undefined));

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(filterInput);
      expect(result).toBeUndefined();
    });

    test('matches by hasContinuationToken false', async () => {
      router.route(defineRoute({ filters: { hasContinuationToken: false } }).handle(async () => undefined));

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(filterInput);
      expect(result).toBeDefined();
    });

    // test('matches by userParametersContains', async () => {
    //   router.route(defineRoute({ filters: { userParametersContains: 'deploy' } }).handle(async () => undefined));

    //   const filterInput: CodePipelineFilterInput = {
    //     functionName: 'my-function',
    //     userParameters: 'deploy-to-staging',
    //     hasInputArtifacts: false,
    //     hasContinuationToken: false,
    //   };

    //   // @ts-expect-error - testing private method directly
    //   const result = await router.matchRoute(filterInput);
    //   expect(result).toBeDefined();
    // });

    // test('rejects when userParametersContains does not match', async () => {
    //   router.route(defineRoute({ filters: { userParametersContains: 'deploy' } }).handle(async () => undefined));

    //   const filterInput: CodePipelineFilterInput = {
    //     functionName: 'my-function',
    //     userParameters: 'build-only',
    //     hasInputArtifacts: false,
    //     hasContinuationToken: false,
    //   };

    //   // @ts-expect-error - testing private method directly
    //   const result = await router.matchRoute(filterInput);
    //   expect(result).toBeUndefined();
    // });

    test('matches by custom', async () => {
      const custom = (input: CodePipelineFilterInput): boolean => {
        return input.functionName.startsWith('my-');
      };
      router.route(defineRoute({ filters: { custom } }).handle(async () => undefined));

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(filterInput);
      expect(result).toBeDefined();
    });

    test('rejects when custom returns false', async () => {
      const custom = (): boolean => false;
      router.route(defineRoute({ filters: { custom } }).handle(async () => undefined));

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(filterInput);
      expect(result).toBeUndefined();
    });

    test('matches route by async custom', async () => {
      const custom = async (input: CodePipelineFilterInput): Promise<boolean> => {
        return input.functionName === 'my-function';
      };
      router.route(defineRoute({ filters: { custom } }).handle(async () => undefined));

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(filterInput);
      expect(result).toBeDefined();
    });

    test('all filters must pass for a match', async () => {
      router.route(
        defineRoute({
          filters: {
            functionName: 'my-function',
            hasInputArtifacts: true,
            hasContinuationToken: false,
          },
        }).handle(async () => undefined),
      );

      const matchingInput: CodePipelineFilterInput = {
        functionName: 'my-function',
        userParameters: '',
        hasInputArtifacts: true,
        hasContinuationToken: false,
      };

      // @ts-expect-error - testing private method directly
      const matched = await router.matchRoute(matchingInput);
      expect(matched).toBeDefined();

      const failingInput: CodePipelineFilterInput = {
        functionName: 'my-function',
        userParameters: '',
        hasInputArtifacts: false,
        hasContinuationToken: false,
      };

      // @ts-expect-error - testing private method directly
      const notMatched = await router.matchRoute(failingInput);
      expect(notMatched).toBeUndefined();
    });

    test('returns first matching route', async () => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();
      router.route(defineRoute({ filters: {} }).handle(firstHandler));
      router.route(defineRoute({ filters: {} }).handle(secondHandler));

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(filterInput);
      expect(result).toBeDefined();
      expect(result?.handler).toBe(firstHandler);
    });
  });

  suite('handleEvent', () => {
    test('calls matched handler with correct CodePipelineRequest fields', async ({ context }) => {
      const handler = vi.fn().mockResolvedValue(undefined);
      router.route(defineRoute({ filters: {} }).handle(handler));

      const event = createCodePipelineEvent({ functionName: 'my-func', userParameters: '{"env":"prod"}' });
      const ctx = context();
      await router.handleEvent(event, ctx);

      const job = event['CodePipeline.job'];

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: job.id,
          functionName: 'my-func',
          userParameters: { env: 'prod' },
          inputArtifacts: job.data.inputArtifacts,
          outputArtifacts: job.data.outputArtifacts,
          artifactCredentials: job.data.artifactCredentials,
          continuationToken: undefined,
          event,
          context: ctx,
        }),
      );
    });

    test('reports success via PutJobSuccessResultCommand', async ({ codePipelineHandlerEvent }) => {
      router.route(
        defineRoute({ filters: {} }).handle(async () => ({
          outputVariables: { buildId: '123' },
        })),
      );

      const { event, context } = codePipelineHandlerEvent({ event: { id: 'test-job-id' } });
      await router.handleEvent(event, context);

      expect(mockSend).toHaveBeenCalledOnce();
      const sentCommand = getSentCommand();
      expect(sentCommand.input).toEqual({
        jobId: 'test-job-id',
        outputVariables: { buildId: '123' },
        continuationToken: undefined,
      });
    });

    test('reports success with outputVariables and continuationToken', async ({ codePipelineHandlerEvent }) => {
      router.route(
        defineRoute({ filters: {} }).handle(async () => ({
          outputVariables: { status: 'ok' },
          continuationToken: 'next-token',
        })),
      );

      const { event, context } = codePipelineHandlerEvent({ event: { id: 'test-job-id' } });
      await router.handleEvent(event, context);

      const sentCommand = getSentCommand();
      expect(sentCommand.input).toEqual({
        jobId: 'test-job-id',
        outputVariables: { status: 'ok' },
        continuationToken: 'next-token',
      });
    });

    test('reports success with just jobId when handler returns undefined', async ({ codePipelineHandlerEvent }) => {
      router.route(defineRoute({ filters: {} }).handle(async () => undefined));

      const { event, context } = codePipelineHandlerEvent({ event: { id: 'test-job-id' } });
      await router.handleEvent(event, context);

      const sentCommand = getSentCommand();
      expect(sentCommand.input).toEqual({ jobId: 'test-job-id' });
    });

    test('reports failure and re-throws when handler throws Error', async ({ codePipelineHandlerEvent }) => {
      const handlerError = new Error('handler failed');
      router.route(
        defineRoute({ filters: {} }).handle(async () => {
          throw handlerError;
        }),
      );

      const { event, context } = codePipelineHandlerEvent({ event: { id: 'test-job-id' } });
      await expect(router.handleEvent(event, context)).rejects.toThrow('handler failed');

      const sentCommand = getSentCommand();
      expect(sentCommand.input).toEqual({
        jobId: 'test-job-id',
        failureDetails: {
          type: 'JobFailed',
          message: 'handler failed',
        },
      });
    });

    test('reports failure and re-throws when handler throws non-Error', async ({ codePipelineHandlerEvent }) => {
      router.route(
        defineRoute({ filters: {} }).handle(async () => {
          throw 'string-error';
        }),
      );

      const { event, context } = codePipelineHandlerEvent({ event: { id: 'test-job-id' } });
      await expect(router.handleEvent(event, context)).rejects.toThrow('string-error');

      const sentCommand = getSentCommand();
      expect(sentCommand.input).toEqual({
        jobId: 'test-job-id',
        failureDetails: {
          type: 'JobFailed',
          message: 'string-error',
        },
      });
    });

    test('throws when no route matches', async ({ codePipelineHandlerEvent }) => {
      const { event, context } = codePipelineHandlerEvent({ event: { id: 'test-job-id' } });
      await expect(router.handleEvent(event, context)).rejects.toThrow('No route matched');
    });

    test('swallows reportFailure errors and re-throws original', async ({ codePipelineHandlerEvent }) => {
      router.route(
        defineRoute({ filters: {} }).handle(async () => {
          throw new Error('original error');
        }),
      );

      mockSend.mockRejectedValue(new Error('report failure error'));

      const { event, context } = codePipelineHandlerEvent({ event: { id: 'test-job-id' } });
      await expect(router.handleEvent(event, context)).rejects.toThrow('original error');
    });

    test('validates userParameters against schema', async ({ context }) => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const schema = createMockSchema();

      router.route(defineRoute({ filters: {}, userParametersSchema: schema }).handle(handler));

      const event = createCodePipelineEvent({ userParameters: '{"env":"staging"}' });
      const ctx = context();
      await router.handleEvent(event, ctx);

      expect(validateSchemaSpy).toHaveBeenCalledWith({ env: 'staging' }, schema, expect.any(String));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ userParameters: { env: 'staging' } }));
    });

    test('throws when schema validation fails', async ({ codePipelineHandlerEvent }) => {
      const schema = createMockSchema({ issues: [{ message: 'invalid' }] });
      router.route(defineRoute({ filters: {}, userParametersSchema: schema }).handle(async () => undefined));

      const { event, context } = codePipelineHandlerEvent({ event: { id: 'test-job-id' } });
      await expect(router.handleEvent(event, context)).rejects.toThrow('UserParameters validation failed');
    });

    test('pascodePipeline userParameters to safeJsonParse', async ({ context }) => {
      const handler = vi.fn().mockResolvedValue(undefined);
      router.route(defineRoute({ filters: {} }).handle(handler));

      const userParameters = '{"action":"deploy"}';
      const event = createCodePipelineEvent({ userParameters });
      const ctx = context();
      await router.handleEvent(event, ctx);

      expect(safeJsonParseSpy).toHaveBeenCalledWith(userParameters);
    });

    test('handles JSON userParameters', async ({ context }) => {
      const handler = vi.fn().mockResolvedValue(undefined);
      router.route(defineRoute({ filters: {} }).handle(handler));

      const event = createCodePipelineEvent({ userParameters: '{"action":"deploy"}' });
      const ctx = context();
      await router.handleEvent(event, ctx);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ userParameters: { action: 'deploy' } }));
    });

    test('handles non-JSON userParameters', async ({ context }) => {
      const handler = vi.fn().mockResolvedValue(undefined);
      router.route(defineRoute({ filters: {} }).handle(handler));

      const event = createCodePipelineEvent({ userParameters: 'plain-string' });
      const ctx = context();
      await router.handleEvent(event, ctx);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ userParameters: 'plain-string' }));
    });

    test('pascodePipeline continuationToken from event to handler request', async ({ context }) => {
      const handler = vi.fn().mockResolvedValue(undefined);
      router.route(defineRoute({ filters: {} }).handle(handler));

      const event = createCodePipelineEvent({ continuationToken: 'my-token' });
      const ctx = context();
      await router.handleEvent(event, ctx);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ continuationToken: 'my-token' }));
    });
  });

  suite('router-level middleware', () => {
    test('executes middleware before the route handler', async ({ codePipelineHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middleware(request: CodePipelineRequest, next: CodePipelineNext): Promise<CodePipelineResponse> {
        callOrder.push('mw-pre');
        const result = await next(request);
        callOrder.push('mw-post');
        return result;
      }

      const router = createCodePipelineRouter({ middleware: [middleware] });
      router.route({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
          return undefined;
        },
      });

      const { event, context } = codePipelineHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
    });

    test('allows middleware to skip a record by not calling next', async ({ codePipelineHandlerEvent }) => {
      const handler = vi.fn();

      async function skipMiddleware(
        _request: CodePipelineRequest,
        _next: CodePipelineNext,
      ): Promise<CodePipelineResponse> {
        return undefined;
      }

      const router = createCodePipelineRouter({ middleware: [skipMiddleware] });
      router.route({ filters: {}, handler });

      const { event, context } = codePipelineHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple router-level middleware in order', async ({ codePipelineHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middlewareOne(
        request: CodePipelineRequest,
        next: CodePipelineNext,
      ): Promise<CodePipelineResponse> {
        callOrder.push('mw1');
        return next(request);
      }

      async function middlewareTwo(
        request: CodePipelineRequest,
        next: CodePipelineNext,
      ): Promise<CodePipelineResponse> {
        callOrder.push('mw2');
        return next(request);
      }

      const router = createCodePipelineRouter({ middleware: [middlewareOne, middlewareTwo] });
      router.route({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
          return undefined;
        },
      });

      const { event, context } = codePipelineHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw1', 'mw2', 'handler']);
    });
  });

  suite('route-level middleware', () => {
    test('executes route-level middleware for a specific route', async ({ codePipelineHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddleware(
        request: CodePipelineRequest,
        next: CodePipelineNext,
      ): Promise<CodePipelineResponse> {
        callOrder.push('route-mw');
        return next(request);
      }

      router.route({
        filters: {},
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
          return undefined;
        },
      });

      const { event, context } = codePipelineHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });

    test('allows route-level middleware to short-circuit by not calling next', async ({ codePipelineHandlerEvent }) => {
      const handler = vi.fn();

      async function blockingRouteMiddleware(
        _request: CodePipelineRequest,
        _next: CodePipelineNext,
      ): Promise<CodePipelineResponse> {
        return undefined;
      }

      router.route({ filters: {}, middleware: [blockingRouteMiddleware], handler });

      const { event, context } = codePipelineHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple route-level middleware in order', async ({ codePipelineHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddlewareOne(
        request: CodePipelineRequest,
        next: CodePipelineNext,
      ): Promise<CodePipelineResponse> {
        callOrder.push('route-mw1');
        return next(request);
      }

      async function routeMiddlewareTwo(
        request: CodePipelineRequest,
        next: CodePipelineNext,
      ): Promise<CodePipelineResponse> {
        callOrder.push('route-mw2');
        return next(request);
      }

      router.route({
        filters: {},
        middleware: [routeMiddlewareOne, routeMiddlewareTwo],
        handler: async () => {
          callOrder.push('handler');
          return undefined;
        },
      });

      const { event, context } = codePipelineHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw1', 'route-mw2', 'handler']);
    });

    test('supports middleware on defineRoute builder pattern', async ({ codePipelineHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddleware(
        request: CodePipelineRequest,
        next: CodePipelineNext,
      ): Promise<CodePipelineResponse> {
        callOrder.push('route-mw');
        return next(request);
      }

      const route = defineRoute({ filters: {}, middleware: [routeMiddleware] }).handle(async () => {
        callOrder.push('handler');
        return undefined;
      });

      router.route(route);

      const { event, context } = codePipelineHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });
  });

  suite('combined router and route middleware', () => {
    test('executes router middleware before route middleware', async ({ codePipelineHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routerMiddleware(
        request: CodePipelineRequest,
        next: CodePipelineNext,
      ): Promise<CodePipelineResponse> {
        callOrder.push('router-mw');
        return next(request);
      }

      async function routeMiddleware(
        request: CodePipelineRequest,
        next: CodePipelineNext,
      ): Promise<CodePipelineResponse> {
        callOrder.push('route-mw');
        return next(request);
      }

      const router = createCodePipelineRouter({ middleware: [routerMiddleware] });
      router.route({
        filters: {},
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
          return undefined;
        },
      });

      const { event, context } = codePipelineHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['router-mw', 'route-mw', 'handler']);
    });

    test('router middleware short-circuit prevents route middleware from running', async ({
      codePipelineHandlerEvent,
    }) => {
      const routeMiddleware = vi.fn();
      const handler = vi.fn();

      async function blockingRouterMiddleware(
        _request: CodePipelineRequest,
        _next: CodePipelineNext,
      ): Promise<CodePipelineResponse> {
        return undefined;
      }

      const router = createCodePipelineRouter({ middleware: [blockingRouterMiddleware] });
      router.route({ filters: {}, middleware: [routeMiddleware], handler });

      const { event, context } = codePipelineHandlerEvent();
      await router.handleEvent(event, context);

      expect(routeMiddleware).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  suite('middleware does not run on validation failure', () => {
    test('does not execute middleware when schema validation fails', async ({ codePipelineHandlerEvent }) => {
      const middleware = vi.fn();
      const userParametersSchema = createMockSchema({ issues: [{ message: 'invalid' }] });

      const router = createCodePipelineRouter({ middleware: [middleware] });
      router.route({ filters: {}, userParametersSchema, handler: vi.fn() });

      const { event, context } = codePipelineHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('UserParameters validation failed');
      expect(middleware).not.toHaveBeenCalled();
    });
  });
});
