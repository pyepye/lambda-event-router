import type { EventTypeRouter, InferSchema, Schema } from '@lambda-event-router/base';
import { isObject } from '@lambda-event-router/base';
import type { Context } from 'aws-lambda';
import type {
  ConfigScheduledRequest,
  ConfigScheduledRouteBuilder,
  ConfigScheduledRouteDefinition,
  ConfigScheduledRouteInput,
  InternalConfigScheduledRoute,
} from './configScheduledRouterTypes.js';
import type { ConfigEvent, ConfigResponse } from './types.js';

export function defineConfigScheduledRoute<
  TParamsSchema extends Schema<unknown> | undefined = undefined,
  TParams = TParamsSchema extends Schema<unknown> ? InferSchema<TParamsSchema> : Record<string, string>,
>(config: ConfigScheduledRouteInput<TParamsSchema>): ConfigScheduledRouteBuilder<TParams> {
  return {
    handle(
      handler: (request: ConfigScheduledRequest<TParams>) => Promise<void>,
    ): ConfigScheduledRouteDefinition<TParams> {
      return {
        filters: config.filters,
        ruleParametersSchema: config.ruleParametersSchema as Schema<TParams> | undefined,
        handler,
      };
    },
  };
}

export class ConfigScheduledRouter implements EventTypeRouter<ConfigEvent, ConfigResponse> {
  private routes: InternalConfigScheduledRoute[] = [];

  canHandleEvent(event: unknown): event is ConfigEvent {
    if (!isObject(event)) return false;
    if (typeof event.invokingEvent !== 'string') return false;
    if (typeof event.configRuleName !== 'string') return false;
    if (typeof event.resultToken !== 'string') return false;

    try {
      const invokingEvent = JSON.parse(event.invokingEvent) as unknown;
      if (!isObject(invokingEvent)) return false;
      return invokingEvent.messageType === 'ScheduledNotification';
    } catch {
      return false;
    }
  }

  route<TParams>(definition: ConfigScheduledRouteDefinition<TParams>): this {
    this.routes.push(definition as InternalConfigScheduledRoute);
    return this;
  }

  async handleEvent(event: ConfigEvent, context: Context): Promise<ConfigResponse> {
    const ruleParameters = JSON.parse(event.ruleParameters || '{}') as Record<string, string>;

    const route = this.matchRoute(event.configRuleName, event.accountId);
    if (!route) {
      throw new Error(`No route matched for scheduled config rule ${event.configRuleName}`);
    }

    const validatedParams = this.validateSchema(ruleParameters, route.ruleParametersSchema, 'ruleParameters');

    const request: ConfigScheduledRequest = {
      resultToken: event.resultToken,
      configRuleName: event.configRuleName,
      accountId: event.accountId,
      ruleParameters: validatedParams,
      event,
      context,
    };

    await route.handler(request);
  }

  private matchRoute(configRuleName: string, accountId: string): InternalConfigScheduledRoute | undefined {
    return this.routes.find((route) => {
      const { filters } = route;

      if (filters.configRuleNames && !filters.configRuleNames.includes(configRuleName)) {
        return false;
      }

      if (filters.accountIds && !filters.accountIds.includes(accountId)) {
        return false;
      }

      return true;
    });
  }

  private validateSchema<T>(data: T, schema: Schema<unknown> | undefined, name: string): T {
    if (!schema || data === undefined) {
      return data;
    }

    const result = schema.safeParse(data);
    if (!result.success) {
      throw new Error(`Schema validation failed for ${name}`, { cause: result.error });
    }
    return result.data as T;
  }
}

export function createConfigScheduledRouter(): ConfigScheduledRouter {
  return new ConfigScheduledRouter();
}
