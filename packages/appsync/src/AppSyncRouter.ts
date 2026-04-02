import type { EventTypeRouter, Middleware } from '@lambda-event-router/base';
import { handleEventWithMiddleware, isObject, validateSchema } from '@lambda-event-router/base';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { AppSyncResolverEvent, Context } from 'aws-lambda';
import type {
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

interface AppSyncRouterOptions {
  middleware?: Middleware<AppSyncResolverRequest, unknown>[];
}

export class AppSyncRouter implements EventTypeRouter<AppSyncResolverEvent<Record<string, unknown>>, unknown> {
  private routes: InternalResolverRoute[] = [];
  private middleware: Middleware<AppSyncResolverRequest, unknown>[];

  constructor(options?: AppSyncRouterOptions) {
    this.middleware = options?.middleware ?? [];
  }

  canHandleEvent(event: unknown): event is AppSyncResolverEvent<Record<string, unknown>> {
    if (!isObject(event)) return false;

    const info = event.info;
    if (!isObject(info)) return false;
    if (typeof info.parentTypeName !== 'string') return false;
    if (typeof info.fieldName !== 'string') return false;

    return true;
  }

  route<TArgs>(definition: AppSyncResolverRouteDefinition<TArgs>): this {
    this.routes.push({
      filters: definition.filters,
      argumentsSchema: definition.argumentsSchema,
      // Casts needed: storing typed middleware/handler in general storage (contravariance)
      middleware: (definition.middleware ?? []) as unknown as Middleware<AppSyncResolverRequest, unknown>[],
      handler: definition.handler as InternalResolverRoute['handler'],
    });
    return this;
  }

  query<TArgs = Record<string, unknown>>(input: AppSyncQueryInput<TArgs>): this {
    return this.route({
      filters: {
        ...input.filters,
        parentTypeNames: ['Query'],
        fieldNames: [input.fieldName],
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
        parentTypeNames: ['Mutation'],
        fieldNames: [input.fieldName],
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
        parentTypeNames: ['Subscription'],
        fieldNames: [input.fieldName],
      },
      argumentsSchema: input.argumentsSchema,
      middleware: input.middleware,
      handler: input.handler,
    });
  }

  async handleEvent(event: AppSyncResolverEvent<Record<string, unknown>>, context: Context): Promise<unknown> {
    const { parentTypeName, fieldName } = event.info;

    const route = this.matchRoute(parentTypeName, fieldName, event);
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
    if (allMiddleware.length > 0) {
      return handleEventWithMiddleware(allMiddleware, request, route.handler);
    }
    return route.handler(request);
  }

  private matchRoute(
    parentTypeName: string,
    fieldName: string,
    event: AppSyncResolverEvent<Record<string, unknown>>,
  ): InternalResolverRoute | undefined {
    return this.routes.find((route) => {
      const { filters } = route;

      if (filters.parentTypeNames && !filters.parentTypeNames.includes(parentTypeName)) {
        return false;
      }

      if (filters.fieldNames && !filters.fieldNames.includes(fieldName)) {
        return false;
      }

      if (filters.customFilter) {
        return filters.customFilter({ parentTypeName, fieldName, event });
      }

      return true;
    });
  }
}

export function createAppSyncRouter(options?: AppSyncRouterOptions): AppSyncRouter {
  return new AppSyncRouter(options);
}
