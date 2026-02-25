import type { EventTypeRouter, InferSchema, Schema } from '@lambda-event-router/base';
import { isObject } from '@lambda-event-router/base';
import type { AppSyncResolverEvent, Context } from 'aws-lambda';
import type {
  AppSyncMutationInput,
  AppSyncQueryInput,
  AppSyncResolverRequest,
  AppSyncResolverRouteBuilder,
  AppSyncResolverRouteDefinition,
  AppSyncResolverRouteInput,
  AppSyncSubscriptionInput,
  InternalResolverRoute,
} from './types.js';

export function defineRoute<TArgumentsSchema extends Schema<unknown> | undefined = undefined>(
  config: AppSyncResolverRouteInput<TArgumentsSchema>,
): AppSyncResolverRouteBuilder<
  TArgumentsSchema extends Schema<unknown> ? InferSchema<TArgumentsSchema> : Record<string, unknown>
> {
  type TArgs = TArgumentsSchema extends Schema<unknown> ? InferSchema<TArgumentsSchema> : Record<string, unknown>;

  return {
    handle(
      handler: (request: AppSyncResolverRequest<TArgs>) => Promise<unknown>,
    ): AppSyncResolverRouteDefinition<TArgs> {
      return {
        filters: config.filters,
        argumentsSchema: config.argumentsSchema as Schema<TArgs> | undefined,
        handler,
      };
    },
  };
}

export class AppSyncRouter implements EventTypeRouter<AppSyncResolverEvent<Record<string, unknown>>, unknown> {
  private routes: InternalResolverRoute[] = [];

  canHandleEvent(event: unknown): event is AppSyncResolverEvent<Record<string, unknown>> {
    if (!isObject(event)) return false;

    const info = event.info;
    if (!isObject(info)) return false;
    if (typeof info.parentTypeName !== 'string') return false;
    if (typeof info.fieldName !== 'string') return false;

    return true;
  }

  route<TArgs>(definition: AppSyncResolverRouteDefinition<TArgs>): this {
    this.routes.push(definition as InternalResolverRoute);
    return this;
  }

  query<TArgs = Record<string, unknown>>(input: AppSyncQueryInput<TArgs>): this {
    return this.route({
      filters: {
        parentTypeNames: ['Query'],
        fieldNames: [input.fieldName],
      },
      argumentsSchema: input.argumentsSchema,
      handler: input.handler,
    });
  }

  mutation<TArgs = Record<string, unknown>>(input: AppSyncMutationInput<TArgs>): this {
    return this.route({
      filters: {
        parentTypeNames: ['Mutation'],
        fieldNames: [input.fieldName],
      },
      argumentsSchema: input.argumentsSchema,
      handler: input.handler,
    });
  }

  subscription<TArgs = Record<string, unknown>>(input: AppSyncSubscriptionInput<TArgs>): this {
    return this.route({
      filters: {
        parentTypeNames: ['Subscription'],
        fieldNames: [input.fieldName],
      },
      argumentsSchema: input.argumentsSchema,
      handler: input.handler,
    });
  }

  async handleEvent(event: AppSyncResolverEvent<Record<string, unknown>>, context: Context): Promise<unknown> {
    const { parentTypeName, fieldName } = event.info;

    const route = this.matchRoute(parentTypeName, fieldName, event);
    if (!route) {
      throw new Error(`No route matched for ${parentTypeName}.${fieldName}`);
    }

    const validatedArguments = this.validateArguments(
      event.arguments,
      route.argumentsSchema,
      parentTypeName,
      fieldName,
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

  private validateArguments<T>(
    args: T,
    schema: Schema<unknown> | undefined,
    parentTypeName: string,
    fieldName: string,
  ): T {
    if (!schema) {
      return args;
    }

    const result = schema.safeParse(args);
    if (!result.success) {
      throw new Error(`Arguments validation failed for ${parentTypeName}.${fieldName}`);
    }
    return result.data as T;
  }
}

export function createAppSyncRouter(): AppSyncRouter {
  return new AppSyncRouter();
}
