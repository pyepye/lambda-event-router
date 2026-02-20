import { createCodePipelineEvent, test } from '@lambda-event-router/testing';
import type { Mock } from 'vitest';
import { CodePipelineRouter, createCodePipelineRouter, defineRoute } from './CodePipelineRouter.js';
import type { CodePipelineFilterInput } from './types.js';

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
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({});
  });

  suite('createCodePipelineRouter', () => {
    test('creates a CodePipelineRouter instance', () => {
      const router = createCodePipelineRouter();
      expect(router).toBeInstanceOf(CodePipelineRouter);
    });

    test('uses custom CodePipelineClient when provided', async ({ codePipelineHandlerEvent }) => {
      const customSend = vi.fn().mockResolvedValue({});
      const customClient = { send: customSend };

      // @ts-expect-error - partial CodePipelineClient mock with only the send method needed
      const router = createCodePipelineRouter(customClient);
      router.route(defineRoute({ filters: {} }).handle(async () => undefined));

      const { event, context } = codePipelineHandlerEvent({ event: { id: 'custom-client-job' } });
      await router.handleEvent(event, context);

      expect(customSend).toHaveBeenCalledOnce();
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  suite('canHandleEvent', () => {
    let router: CodePipelineRouter;

    beforeEach(() => {
      router = new CodePipelineRouter();
    });

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
        filters: { functionNames: ['my-function'] },
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });

    test('preserves filters, userParametersSchema, and handler in the definition', () => {
      const handler = vi.fn();
      const filters = { functionNames: ['my-function'] };
      const userParametersSchema = {
        safeParse: vi.fn(),
      };

      const definition = defineRoute({ filters, userParametersSchema }).handle(handler);

      expect(definition).toEqual({ filters, userParametersSchema, handler });
    });
  });

  suite('route', () => {
    test('returns the router instance for chaining', () => {
      const router = new CodePipelineRouter();
      const definition = defineRoute({
        filters: { functionNames: ['my-function'] },
      }).handle(async () => undefined);

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  suite('continuation', () => {
    test('returns the router instance for chaining', () => {
      const router = new CodePipelineRouter();

      const result = router.continuation({
        filters: {},
        handler: async () => undefined,
      });

      expect(result).toBe(router);
    });

    test('sets hasContinuationToken to true in filters', () => {
      const router = new CodePipelineRouter();
      const handler = vi.fn();

      router.continuation({
        filters: { functionNames: ['my-function'] },
        handler,
      });

      const filterInput: CodePipelineFilterInput = {
        functionName: 'my-function',
        userParameters: '',
        hasInputArtifacts: false,
        hasContinuationToken: true,
      };

      // @ts-expect-error - testing private method directly
      const matched = router.matchRoute(filterInput);
      expect(matched).toBeDefined();

      const filterInputWithoutToken: CodePipelineFilterInput = {
        ...filterInput,
        hasContinuationToken: false,
      };

      // @ts-expect-error - testing private method directly
      const notMatched = router.matchRoute(filterInputWithoutToken);
      expect(notMatched).toBeUndefined();
    });
  });

  suite('matchRoute', () => {
    let router: CodePipelineRouter;

    beforeEach(() => {
      router = createCodePipelineRouter();
    });

    test('matches when no filters are set', () => {
      router.route(defineRoute({ filters: {} }).handle(async () => undefined));

      const filterInput: CodePipelineFilterInput = {
        functionName: 'my-function',
        userParameters: '',
        hasInputArtifacts: false,
        hasContinuationToken: false,
      };

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(filterInput);
      expect(result).toBeDefined();
    });

    test('matches by functionNames', () => {
      router.route(defineRoute({ filters: { functionNames: ['my-function'] } }).handle(async () => undefined));

      const filterInput: CodePipelineFilterInput = {
        functionName: 'my-function',
        userParameters: '',
        hasInputArtifacts: false,
        hasContinuationToken: false,
      };

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(filterInput);
      expect(result).toBeDefined();
    });

    test('rejects when functionNames does not match', () => {
      router.route(defineRoute({ filters: { functionNames: ['other-function'] } }).handle(async () => undefined));

      const filterInput: CodePipelineFilterInput = {
        functionName: 'my-function',
        userParameters: '',
        hasInputArtifacts: false,
        hasContinuationToken: false,
      };

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(filterInput);
      expect(result).toBeUndefined();
    });

    test('matches by hasInputArtifacts true', () => {
      router.route(defineRoute({ filters: { hasInputArtifacts: true } }).handle(async () => undefined));

      const filterInput: CodePipelineFilterInput = {
        functionName: 'my-function',
        userParameters: '',
        hasInputArtifacts: true,
        hasContinuationToken: false,
      };

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(filterInput);
      expect(result).toBeDefined();
    });

    test('rejects when hasInputArtifacts does not match', () => {
      router.route(defineRoute({ filters: { hasInputArtifacts: true } }).handle(async () => undefined));

      const filterInput: CodePipelineFilterInput = {
        functionName: 'my-function',
        userParameters: '',
        hasInputArtifacts: false,
        hasContinuationToken: false,
      };

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(filterInput);
      expect(result).toBeUndefined();
    });

    test('matches by hasInputArtifacts false', () => {
      router.route(defineRoute({ filters: { hasInputArtifacts: false } }).handle(async () => undefined));

      const filterInput: CodePipelineFilterInput = {
        functionName: 'my-function',
        userParameters: '',
        hasInputArtifacts: false,
        hasContinuationToken: false,
      };

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(filterInput);
      expect(result).toBeDefined();
    });

    test('matches by hasContinuationToken true', () => {
      router.route(defineRoute({ filters: { hasContinuationToken: true } }).handle(async () => undefined));

      const filterInput: CodePipelineFilterInput = {
        functionName: 'my-function',
        userParameters: '',
        hasInputArtifacts: false,
        hasContinuationToken: true,
      };

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(filterInput);
      expect(result).toBeDefined();
    });

    test('rejects when hasContinuationToken does not match', () => {
      router.route(defineRoute({ filters: { hasContinuationToken: true } }).handle(async () => undefined));

      const filterInput: CodePipelineFilterInput = {
        functionName: 'my-function',
        userParameters: '',
        hasInputArtifacts: false,
        hasContinuationToken: false,
      };

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(filterInput);
      expect(result).toBeUndefined();
    });

    test('matches by hasContinuationToken false', () => {
      router.route(defineRoute({ filters: { hasContinuationToken: false } }).handle(async () => undefined));

      const filterInput: CodePipelineFilterInput = {
        functionName: 'my-function',
        userParameters: '',
        hasInputArtifacts: false,
        hasContinuationToken: false,
      };

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(filterInput);
      expect(result).toBeDefined();
    });

    test('matches by userParametersContains', () => {
      router.route(defineRoute({ filters: { userParametersContains: 'deploy' } }).handle(async () => undefined));

      const filterInput: CodePipelineFilterInput = {
        functionName: 'my-function',
        userParameters: 'deploy-to-staging',
        hasInputArtifacts: false,
        hasContinuationToken: false,
      };

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(filterInput);
      expect(result).toBeDefined();
    });

    test('rejects when userParametersContains does not match', () => {
      router.route(defineRoute({ filters: { userParametersContains: 'deploy' } }).handle(async () => undefined));

      const filterInput: CodePipelineFilterInput = {
        functionName: 'my-function',
        userParameters: 'build-only',
        hasInputArtifacts: false,
        hasContinuationToken: false,
      };

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(filterInput);
      expect(result).toBeUndefined();
    });

    test('matches by customFilter', () => {
      const customFilter = (input: CodePipelineFilterInput): boolean => {
        return input.functionName.startsWith('my-');
      };

      router.route(defineRoute({ filters: { customFilter } }).handle(async () => undefined));

      const filterInput: CodePipelineFilterInput = {
        functionName: 'my-function',
        userParameters: '',
        hasInputArtifacts: false,
        hasContinuationToken: false,
      };

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(filterInput);
      expect(result).toBeDefined();
    });

    test('rejects when customFilter returns false', () => {
      const customFilter = (): boolean => false;

      router.route(defineRoute({ filters: { customFilter } }).handle(async () => undefined));

      const filterInput: CodePipelineFilterInput = {
        functionName: 'my-function',
        userParameters: '',
        hasInputArtifacts: false,
        hasContinuationToken: false,
      };

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(filterInput);
      expect(result).toBeUndefined();
    });

    test('all filters must pass for a match', () => {
      router.route(
        defineRoute({
          filters: {
            functionNames: ['my-function'],
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
      const matched = router.matchRoute(matchingInput);
      expect(matched).toBeDefined();

      const failingInput: CodePipelineFilterInput = {
        functionName: 'my-function',
        userParameters: '',
        hasInputArtifacts: false,
        hasContinuationToken: false,
      };

      // @ts-expect-error - testing private method directly
      const notMatched = router.matchRoute(failingInput);
      expect(notMatched).toBeUndefined();
    });

    test('returns first matching route', () => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();

      router.route(defineRoute({ filters: {} }).handle(firstHandler));
      router.route(defineRoute({ filters: {} }).handle(secondHandler));

      const filterInput: CodePipelineFilterInput = {
        functionName: 'my-function',
        userParameters: '',
        hasInputArtifacts: false,
        hasContinuationToken: false,
      };

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(filterInput);
      expect(result).toBeDefined();
      // @ts-expect-error - result is asserted as defined above
      expect(result.handler).toBe(firstHandler);
    });
  });

  suite('parseUserParameters', () => {
    let router: CodePipelineRouter;

    beforeEach(() => {
      router = createCodePipelineRouter();
    });

    test('parses valid JSON object', () => {
      // @ts-expect-error - testing private method directly
      const result = router.parseUserParameters('{"key":"value"}');
      expect(result).toEqual({ key: 'value' });
    });

    test('returns raw string for non-JSON', () => {
      // @ts-expect-error - testing private method directly
      const result = router.parseUserParameters('not-json');
      expect(result).toBe('not-json');
    });

    test('parses JSON number', () => {
      // @ts-expect-error - testing private method directly
      const result = router.parseUserParameters('42');
      expect(result).toBe(42);
    });

    test('parses JSON array', () => {
      // @ts-expect-error - testing private method directly
      const result = router.parseUserParameters('[1,2,3]');
      expect(result).toEqual([1, 2, 3]);
    });

    test('parses JSON boolean', () => {
      // @ts-expect-error - testing private method directly
      const result = router.parseUserParameters('true');
      expect(result).toBe(true);
    });
  });

  suite('validateUserParameters', () => {
    let router: CodePipelineRouter;

    beforeEach(() => {
      router = createCodePipelineRouter();
    });

    test('returns params unchanged when no schema', () => {
      const params = { key: 'value' };
      // @ts-expect-error - testing private method directly
      const result = router.validateUserParameters('job-1', params, undefined);
      expect(result).toBe(params);
    });

    test('returns schema.data when validation passes', () => {
      const parsedData = { key: 'validated' };
      const schema = {
        safeParse: vi.fn().mockReturnValue({ success: true, data: parsedData }),
      };

      // @ts-expect-error - testing private method directly
      const result = router.validateUserParameters('job-1', { key: 'value' }, schema);
      expect(result).toBe(parsedData);
    });

    test('throws when validation fails', () => {
      const schema = {
        safeParse: vi.fn().mockReturnValue({ success: false }),
      };

      // @ts-expect-error - testing private method directly
      expect(() => router.validateUserParameters('job-1', 'bad', schema)).toThrow(
        'UserParameters validation failed for job job-1',
      );
    });
  });

  suite('handleEvent', () => {
    test('calls matched handler with correct CodePipelineJobRequest fields', async ({ context }) => {
      const router = createCodePipelineRouter();
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
      const router = createCodePipelineRouter();

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
      const router = createCodePipelineRouter();

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
      const router = createCodePipelineRouter();

      router.route(defineRoute({ filters: {} }).handle(async () => undefined));

      const { event, context } = codePipelineHandlerEvent({ event: { id: 'test-job-id' } });
      await router.handleEvent(event, context);

      const sentCommand = getSentCommand();
      expect(sentCommand.input).toEqual({ jobId: 'test-job-id' });
    });

    test('reports failure and re-throws when handler throws Error', async ({ codePipelineHandlerEvent }) => {
      const router = createCodePipelineRouter();
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
      const router = createCodePipelineRouter();

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
      const router = createCodePipelineRouter();

      const { event, context } = codePipelineHandlerEvent({ event: { id: 'test-job-id' } });
      await expect(router.handleEvent(event, context)).rejects.toThrow('No route matched');
    });

    test('swallows reportFailure errors and re-throws original', async ({ codePipelineHandlerEvent }) => {
      const router = createCodePipelineRouter();
      const originalError = new Error('original error');

      router.route(
        defineRoute({ filters: {} }).handle(async () => {
          throw originalError;
        }),
      );

      mockSend.mockRejectedValue(new Error('report failure error'));

      const { event, context } = codePipelineHandlerEvent({ event: { id: 'test-job-id' } });
      await expect(router.handleEvent(event, context)).rejects.toThrow('original error');
    });

    test('validates userParameters against schema', async ({ context }) => {
      const router = createCodePipelineRouter();
      const validatedData = { env: 'staging' };
      const schema = {
        safeParse: vi.fn().mockReturnValue({ success: true, data: validatedData }),
      };
      const handler = vi.fn().mockResolvedValue(undefined);

      router.route(defineRoute({ filters: {}, userParametersSchema: schema }).handle(handler));

      const event = createCodePipelineEvent({ userParameters: '{"env":"staging"}' });
      const ctx = context();
      await router.handleEvent(event, ctx);

      expect(schema.safeParse).toHaveBeenCalledWith({ env: 'staging' });
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ userParameters: validatedData }));
    });

    test('throws when schema validation fails', async ({ codePipelineHandlerEvent }) => {
      const router = createCodePipelineRouter();
      const schema = {
        safeParse: vi.fn().mockReturnValue({ success: false }),
      };

      router.route(defineRoute({ filters: {}, userParametersSchema: schema }).handle(async () => undefined));

      const { event, context } = codePipelineHandlerEvent({ event: { id: 'test-job-id' } });
      await expect(router.handleEvent(event, context)).rejects.toThrow('UserParameters validation failed');
    });

    test('handles JSON userParameters', async ({ context }) => {
      const router = createCodePipelineRouter();
      const handler = vi.fn().mockResolvedValue(undefined);

      router.route(defineRoute({ filters: {} }).handle(handler));

      const event = createCodePipelineEvent({ userParameters: '{"action":"deploy"}' });
      const ctx = context();
      await router.handleEvent(event, ctx);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ userParameters: { action: 'deploy' } }));
    });

    test('handles non-JSON userParameters', async ({ context }) => {
      const router = createCodePipelineRouter();
      const handler = vi.fn().mockResolvedValue(undefined);

      router.route(defineRoute({ filters: {} }).handle(handler));

      const event = createCodePipelineEvent({ userParameters: 'plain-string' });
      const ctx = context();
      await router.handleEvent(event, ctx);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ userParameters: 'plain-string' }));
    });

    test('passes continuationToken from event to handler request', async ({ context }) => {
      const router = createCodePipelineRouter();
      const handler = vi.fn().mockResolvedValue(undefined);

      router.route(defineRoute({ filters: {} }).handle(handler));

      const event = createCodePipelineEvent({ continuationToken: 'my-token' });
      const ctx = context();
      await router.handleEvent(event, ctx);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ continuationToken: 'my-token' }));
    });
  });
});
