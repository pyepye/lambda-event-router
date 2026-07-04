import type { AppSyncResolverEvent, Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { EventTypeRouter } from '@lambda-event-router/base';
import {
  filterStringMatcher,
  handleEventWithMiddleware,
  isObject,
  logger,
  validateSchema,
} from '@lambda-event-router/base';

import type {
  AppSyncBatchResult,
  AppSyncMutationInput,
  AppSyncQueryInput,
  AppSyncResolverMiddleware,
  AppSyncResolverRequest,
  AppSyncResolverRouteBuilder,
  AppSyncResolverRouteDefinition,
  AppSyncResolverRouteInput,
  AppSyncSubscriptionInput,
  InternalResolverRoute,
} from './types.js';

type ResolverEvent = AppSyncResolverEvent<Record<string, unknown>>;

// A resolver with `maxBatchSize` above 0 is sent a list of these, one per field AppSync is resolving.
type ResolverEventInput = ResolverEvent | ResolverEvent[];

function isResolverEvent(event: unknown): event is ResolverEvent {
  if (!isObject(event)) return false;

  const info = event.info;
  if (!isObject(info)) return false;
  if (typeof info.parentTypeName !== 'string') return false;
  if (typeof info.fieldName !== 'string') return false;

  return true;
}

export function defineRoute<TArgumentsSchema extends StandardSchemaV1 | undefined = undefined>(
  config: AppSyncResolverRouteInput<TArgumentsSchema>,
): AppSyncResolverRouteBuilder<
  TArgumentsSchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TArgumentsSchema> : Record<string, unknown>
> {
  type TArgs = TArgumentsSchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TArgumentsSchema>
    : Record<string, unknown>;

  return {
    handle(
      handler: (request: AppSyncResolverRequest<TArgs>) => Promise<unknown>,
    ): AppSyncResolverRouteDefinition<TArgs> {
      return {
        filters: config.filters,
        argumentsSchema: config.argumentsSchema as StandardSchemaV1<unknown, TArgs> | undefined,
        middleware: config.middleware as AppSyncResolverMiddleware<TArgs>[] | undefined,
        handler,
      };
    },
  };
}

export interface AppSyncRouterOptions {
  middleware?: AppSyncResolverMiddleware[];
  batchItemFailures?: boolean;
}

export class AppSyncRouter implements EventTypeRouter<ResolverEventInput, unknown> {
  private routes: InternalResolverRoute[] = [];
  private middleware: AppSyncResolverMiddleware[];
  private batchItemFailures: boolean;

  constructor(options?: AppSyncRouterOptions) {
    this.middleware = options?.middleware ?? [];
    this.batchItemFailures = options?.batchItemFailures ?? false;
  }

  canHandleEvent(event: unknown): event is ResolverEventInput {
    if (Array.isArray(event)) {
      return event.length > 0 && event.every((item) => isResolverEvent(item));
    }

    return isResolverEvent(event);
  }

  route<TArgs>(definition: AppSyncResolverRouteDefinition<TArgs>): this {
    this.routes.push({
      filters: definition.filters,
      argumentsSchema: definition.argumentsSchema,
      // @ts-expect-error Contravariance: typed middleware is safe at runtime because schema validates data before calling handlers
      middleware: definition.middleware ?? [],
      handler: definition.handler as InternalResolverRoute['handler'],
    });
    return this;
  }

  query<TArgs = Record<string, unknown>>(input: AppSyncQueryInput<TArgs>): this {
    return this.route({
      filters: {
        ...input.filters,
        parentTypeName: 'Query',
        fieldName: input.fieldName,
      },
      argumentsSchema: input.argumentsSchema,
      middleware: input.middleware,
      handler: input.handler,
    });
  }

  mutation<TArgs = Record<string, unknown>>(input: AppSyncMutationInput<TArgs>): this {
    return this.route({
      filters: {
        ...input.filters,
        parentTypeName: 'Mutation',
        fieldName: input.fieldName,
      },
      argumentsSchema: input.argumentsSchema,
      middleware: input.middleware,
      handler: input.handler,
    });
  }

  subscription<TArgs = Record<string, unknown>>(input: AppSyncSubscriptionInput<TArgs>): this {
    return this.route({
      filters: {
        ...input.filters,
        parentTypeName: 'Subscription',
        fieldName: input.fieldName,
      },
      argumentsSchema: input.argumentsSchema,
      middleware: input.middleware,
      handler: input.handler,
    });
  }

  async handleEvent(event: ResolverEventInput, context: Context): Promise<unknown> {
    if (Array.isArray(event)) return this.handleBatch(event, context);

    return this.resolveField(event, context);
  }

  private async handleBatch(events: ResolverEvent[], context: Context): Promise<AppSyncBatchResult[]> {
    const settled = await Promise.allSettled(events.map((event) => this.resolveField(event, context)));

    // A batched response has to match the request list in size and order, and each entry has to carry
    // its value under `data`. AppSync reads nothing else from it.
    const results: AppSyncBatchResult[] = [];
    for (const [index, outcome] of settled.entries()) {
      if (outcome.status === 'fulfilled') {
        results.push({ data: outcome.value });
        continue;
      }

      if (!this.batchItemFailures) throw outcome.reason;

      const error: unknown = outcome.reason;
      logger.error(`Error processing AppSync batch item ${index}`, { error });
      results.push({
        data: null,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.name : 'Error',
      });
    }

    return results;
  }

  private async resolveField(event: ResolverEvent, context: Context): Promise<unknown> {
    const { parentTypeName, fieldName } = event.info;

    const route = await this.matchRoute(parentTypeName, fieldName, event);
    if (!route) {
      throw new Error(`No route matched for ${parentTypeName}.${fieldName}`);
    }

    const validatedArguments = await validateSchema(
      event.arguments,
      route.argumentsSchema,
      `Arguments validation failed for ${parentTypeName}.${fieldName}`,
    );

    const request: AppSyncResolverRequest = {
      arguments: validatedArguments,
      identity: event.identity,
      source: event.source,
      info: event.info,
      headers: event.request.headers,
      domainName: event.request.domainName,
      prev: event.prev,
      stash: event.stash,
      event,
      context,
    };

    const allMiddleware = [...this.middleware, ...route.middleware];
    return handleEventWithMiddleware(allMiddleware, request, route.handler);
  }

  private async matchRoute(
    parentTypeName: string,
    fieldName: string,
    event: AppSyncResolverEvent<Record<string, unknown>>,
  ): Promise<InternalResolverRoute | undefined> {
    for (const route of this.routes) {
      const { filters } = route;
      if (filters.parentTypeName) {
        const parentTypeNameMatch = filterStringMatcher(parentTypeName, filters.parentTypeName);
        if (!parentTypeNameMatch) continue;
      }

      if (filters.fieldName) {
        const fieldNameMatch = filterStringMatcher(fieldName, filters.fieldName);
        if (!fieldNameMatch) continue;
      }

      if (filters.custom) {
        const match = await filters.custom({ parentTypeName, fieldName, event });
        if (!match) continue;
      }
      return route;
    }
    return undefined;
  }
}

export function createAppSyncRouter(options?: AppSyncRouterOptions): AppSyncRouter {
  return new AppSyncRouter(options);
}
