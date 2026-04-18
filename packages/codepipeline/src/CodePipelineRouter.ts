import type { PutJobSuccessResultCommandInput } from '@aws-sdk/client-codepipeline';
import {
  CodePipelineClient,
  PutJobFailureResultCommand,
  PutJobSuccessResultCommand,
} from '@aws-sdk/client-codepipeline';
import type { EventTypeRouter } from '@lambda-event-router/base';
import { handleEventWithMiddleware, isObject, safeJsonParse, validateSchema } from '@lambda-event-router/base';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { CodePipelineEvent, Context } from 'aws-lambda';
import type {
  CodePipelineFilterInput,
  CodePipelineFilters,
  CodePipelineJobHandler,
  CodePipelineJobRequest,
  CodePipelineMiddleware,
  CodePipelineResponse,
  CodePipelineRouteDefinition,
  CodePipelineRouterOptions,
} from './types.js';

interface InternalRoute {
  filters: CodePipelineFilters;
  userParametersSchema?: StandardSchemaV1;
  middleware?: CodePipelineMiddleware[];
  handler: CodePipelineJobHandler;
}

interface RouteInput<TUserParametersSchema extends StandardSchemaV1 | undefined = undefined> {
  filters: CodePipelineFilters;
  middleware?: CodePipelineMiddleware[];
  userParametersSchema?: TUserParametersSchema;
}

interface RouteBuilder<TUserParameters> {
  handle(handler: CodePipelineJobHandler<TUserParameters>): CodePipelineRouteDefinition<TUserParameters>;
  handle(
    handler: (request: CodePipelineJobRequest<TUserParameters>) => Promise<void>,
  ): CodePipelineRouteDefinition<TUserParameters>;
}

export function defineRoute<
  TUserParametersSchema extends StandardSchemaV1 | undefined = undefined,
  TUserParameters = TUserParametersSchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TUserParametersSchema>
    : unknown,
>(config: RouteInput<TUserParametersSchema>): RouteBuilder<TUserParameters> {
  return {
    // biome-ignore lint/nursery/useExplicitType: handler type is inferred from RouteBuilder return type
    handle(handler): CodePipelineRouteDefinition<TUserParameters> {
      return { ...config, handler } as CodePipelineRouteDefinition<TUserParameters>;
    },
  };
}

export class CodePipelineRouter implements EventTypeRouter<CodePipelineEvent, void> {
  private routes: InternalRoute[] = [];
  private codePipelineClient: CodePipelineClient;
  private middleware: CodePipelineMiddleware[];

  constructor(options?: CodePipelineRouterOptions) {
    this.codePipelineClient = options?.client ?? new CodePipelineClient();
    this.middleware = options?.middleware ?? [];
  }

  canHandleEvent(event: unknown): event is CodePipelineEvent {
    if (!isObject(event)) return false;

    const job = event['CodePipeline.job'];
    if (!isObject(job)) return false;

    return typeof job.id === 'string' && isObject(job.data);
  }

  route<TUserParameters>(definition: CodePipelineRouteDefinition<TUserParameters>): this {
    this.routes.push({
      filters: definition.filters,
      userParametersSchema: definition.userParametersSchema,
      middleware: definition.middleware as CodePipelineMiddleware[] | undefined,
      handler: definition.handler as CodePipelineJobHandler,
    });
    return this;
  }

  continuation<TUserParameters>(
    definition: Omit<CodePipelineRouteDefinition<TUserParameters>, 'filters'> & {
      filters: Omit<CodePipelineFilters, 'hasContinuationToken'>;
    },
  ): this {
    return this.route({
      ...definition,
      filters: {
        ...definition.filters,
        hasContinuationToken: true,
      },
    });
  }

  async handleEvent(event: CodePipelineEvent, context: Context): Promise<void> {
    const job = event['CodePipeline.job'];
    const jobId = job.id;

    try {
      const { configuration } = job.data.actionConfiguration;
      const functionName = configuration.FunctionName;
      const rawUserParameters = configuration.UserParameters;

      const filterInput: CodePipelineFilterInput = {
        functionName,
        userParameters: rawUserParameters,
        hasInputArtifacts: job.data.inputArtifacts.length > 0,
        hasContinuationToken: job.data.continuationToken !== undefined,
      };

      const route = await this.matchRoute(filterInput);
      if (!route) {
        throw new Error(`No route matched for CodePipeline job ${jobId} (function: ${functionName})`);
      }

      const parsedUserParameters = safeJsonParse(rawUserParameters);
      const validatedUserParameters = await validateSchema(
        parsedUserParameters,
        route.userParametersSchema,
        `UserParameters validation failed for job ${jobId}`,
      );

      const request: CodePipelineJobRequest = {
        jobId,
        functionName,
        userParameters: validatedUserParameters,
        inputArtifacts: job.data.inputArtifacts,
        outputArtifacts: job.data.outputArtifacts,
        artifactCredentials: job.data.artifactCredentials,
        continuationToken: job.data.continuationToken,
        event,
        context,
      };

      const allMiddleware = [...this.middleware, ...(route.middleware ?? [])];
      const response = await handleEventWithMiddleware(allMiddleware, request, route.handler);
      await this.reportSuccess(jobId, response);
    } catch (error) {
      try {
        await this.reportFailure(jobId, error);
      } catch {
        // Swallow reportFailure errors to ensure the original error is always re-thrown
      }
      throw error;
    }
  }

  private async matchRoute(input: CodePipelineFilterInput): Promise<InternalRoute | undefined> {
    for (const route of this.routes) {
      const { filters } = route;

      if (filters.functionName) {
        const functionNames = Array.isArray(filters.functionName) ? filters.functionName : [filters.functionName];
        if (!functionNames.includes(input.functionName)) {
          continue;
        }
      }

      if (filters.hasInputArtifacts !== undefined && filters.hasInputArtifacts !== input.hasInputArtifacts) {
        continue;
      }

      if (filters.hasContinuationToken !== undefined && filters.hasContinuationToken !== input.hasContinuationToken) {
        continue;
      }

      if (filters.userParametersContains && !input.userParameters.includes(filters.userParametersContains)) {
        continue;
      }

      if (filters.customFilter) {
        const match = await filters.customFilter(input);
        if (!match) continue;
      }

      return route;
    }

    return undefined;
  }

  private async reportSuccess(jobId: string, response: CodePipelineResponse): Promise<void> {
    const input: PutJobSuccessResultCommandInput = { jobId };

    if (response) {
      input.outputVariables = response.outputVariables;
      input.continuationToken = response.continuationToken;
    }

    const command = new PutJobSuccessResultCommand(input);
    await this.codePipelineClient.send(command);
  }

  private async reportFailure(jobId: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);

    const command = new PutJobFailureResultCommand({
      jobId,
      failureDetails: {
        type: 'JobFailed',
        message,
      },
    });

    await this.codePipelineClient.send(command);
  }
}

export function createCodePipelineRouter(options?: CodePipelineRouterOptions): CodePipelineRouter {
  return new CodePipelineRouter(options);
}
