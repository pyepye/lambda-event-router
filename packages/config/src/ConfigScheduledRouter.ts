import type { EventTypeRouter } from '@lambda-event-router/base';
import { isObject, validateSchema } from '@lambda-event-router/base';
import type { StandardSchemaV1 } from '@standard-schema/spec';
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
  TParamsSchema extends StandardSchemaV1 | undefined = undefined,
  TParams = TParamsSchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TParamsSchema>
    : Record<string, string>,
>(config: ConfigScheduledRouteInput<TParamsSchema>): ConfigScheduledRouteBuilder<TParams> {
  return {
    handle(
      handler: (request: ConfigScheduledRequest<TParams>) => Promise<void>,
    ): ConfigScheduledRouteDefinition<TParams> {
      return {
        filters: config.filters,
        ruleParametersSchema: config.ruleParametersSchema as StandardSchemaV1<unknown, TParams> | undefined,
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

    const validatedParams = (await validateSchema(
      ruleParameters,
      route.ruleParametersSchema,
      'Schema validation failed for ruleParameters',
    )) as Record<string, string>; // TODO: Fix / improve typing so `as` isn't needed

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
}

export function createConfigScheduledRouter(): ConfigScheduledRouter {
  return new ConfigScheduledRouter();
}
