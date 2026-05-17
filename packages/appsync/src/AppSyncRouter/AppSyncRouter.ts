import type { AppSyncResolverEvent, Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { EventTypeRouter } from '@lambda-event-router/base';
import { filterStringMatcher, handleEventWithMiddleware, isObject, validateSchema } from '@lambda-event-router/base';

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

export interface AppSyncRouterOptions {
  middleware?: AppSyncResolverMiddleware[];
}

export class AppSyncRouter implements EventTypeRouter<AppSyncResolverEvent<Record<string, unknown>>, unknown> {
  private routes: InternalResolverRoute[] = [];
  private middleware: AppSyncResolverMiddleware[];

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

  async handleEvent(event: AppSyncResolverEvent<Record<string, unknown>>, context: Context): Promise<unknown> {
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

      if (filters.customFilter) {
        const match = await filters.customFilter({ parentTypeName, fieldName, event });
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
