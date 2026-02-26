import type { EventTypeRouter, InferSchema, Schema } from '@lambda-event-router/base';
import { isObject } from '@lambda-event-router/base';
import type { Context } from 'aws-lambda';
import type {
  ConfigOversizedRequest,
  ConfigRequest,
  ConfigRouteBuilder,
  ConfigRouteDefinition,
  ConfigRouteInput,
  InternalConfigRoute,
} from './configRouterTypes.js';
import type {
  ConfigEvent,
  ConfigResponse,
  ConfigurationItem,
  ConfigurationItemSummary,
  InvokingEvent,
} from './types.js';

export function defineRoute<
  TParamsSchema extends Schema<unknown> | undefined = undefined,
  TConfigSchema extends Schema<unknown> | undefined = undefined,
  TParams = TParamsSchema extends Schema<unknown> ? InferSchema<TParamsSchema> : Record<string, string>,
  TConfig = TConfigSchema extends Schema<unknown> ? InferSchema<TConfigSchema> : Record<string, unknown>,
>(config: ConfigRouteInput<TParamsSchema, TConfigSchema>): ConfigRouteBuilder<TConfig, TParams> {
  return {
    handle(
      handler: (request: ConfigRequest<TConfig, TParams> | ConfigOversizedRequest<TParams>) => Promise<void>,
    ): ConfigRouteDefinition<TConfig, TParams> {
      return {
        filters: config.filters,
        ruleParametersSchema: config.ruleParametersSchema as Schema<TParams> | undefined,
        configurationSchema: config.configurationSchema as Schema<TConfig> | undefined,
        handler,
      };
    },
  };
}

const CHANGE_MESSAGE_TYPES: Set<string> = new Set([
  'ConfigurationItemChangeNotification',
  'OversizedConfigurationItemChangeNotification',
]);

export class ConfigRouter implements EventTypeRouter<ConfigEvent, ConfigResponse> {
  private routes: InternalConfigRoute[] = [];

  canHandleEvent(event: unknown): event is ConfigEvent {
    if (!isObject(event)) return false;
    if (typeof event.invokingEvent !== 'string') return false;
    if (typeof event.configRuleName !== 'string') return false;
    if (typeof event.resultToken !== 'string') return false;

    try {
      const invokingEvent = JSON.parse(event.invokingEvent) as unknown;
      if (!isObject(invokingEvent)) return false;
      return CHANGE_MESSAGE_TYPES.has(invokingEvent.messageType as string);
    } catch {
      return false;
    }
  }

  route<TConfig, TParams>(definition: ConfigRouteDefinition<TConfig, TParams>): this {
    this.routes.push(definition as InternalConfigRoute);
    return this;
  }

  async handleEvent(event: ConfigEvent, context: Context): Promise<ConfigResponse> {
    const invokingEvent = JSON.parse(event.invokingEvent) as InvokingEvent;
    const ruleParameters = JSON.parse(event.ruleParameters || '{}') as Record<string, string>;
    const { messageType } = invokingEvent;

    const isOversized = messageType === 'OversizedConfigurationItemChangeNotification';
    const configurationItem = invokingEvent.configurationItem;
    const configurationItemSummary = invokingEvent.configurationItemSummary;

    const resourceType = isOversized ? configurationItemSummary?.resourceType : configurationItem?.resourceType;
    const resourceId = isOversized ? configurationItemSummary?.resourceId : configurationItem?.resourceId;
    const configurationItemStatus = isOversized
      ? configurationItemSummary?.configurationItemStatus
      : configurationItem?.configurationItemStatus;

    const route = this.matchRoute({
      configRuleName: event.configRuleName,
      resourceType,
      resourceId,
      configurationItemStatus,
    });

    if (!route) {
      throw new Error(`No route matched for config rule ${event.configRuleName}`);
    }

    const validatedParams = this.validateSchema(ruleParameters, route.ruleParametersSchema, 'ruleParameters');

    const handler = route.handler as (request: ConfigRequest | ConfigOversizedRequest) => Promise<void>;

    if (isOversized) {
      const request: ConfigOversizedRequest = {
        configurationItemSummary: configurationItemSummary as ConfigurationItemSummary,
        configurationItem: undefined,
        ruleParameters: validatedParams,
        resultToken: event.resultToken,
        configRuleName: event.configRuleName,
        event,
        context,
      };
      await handler(request);
      return;
    }

    const validatedConfiguration = this.validateSchema(
      configurationItem?.configuration,
      route.configurationSchema,
      'configuration',
    );

    const itemWithValidatedConfig: ConfigurationItem = configurationItem
      ? { ...configurationItem, configuration: validatedConfiguration ?? configurationItem.configuration }
      : (configurationItem as unknown as ConfigurationItem);

    const request: ConfigRequest = {
      configurationItem: itemWithValidatedConfig,
      configurationItemSummary: undefined,
      ruleParameters: validatedParams,
      resultToken: event.resultToken,
      configRuleName: event.configRuleName,
      event,
      context,
    };
    await handler(request);
  }

  private matchRoute(input: {
    configRuleName: string;
    resourceType?: string;
    resourceId?: string;
    configurationItemStatus?: string;
  }): InternalConfigRoute | undefined {
    return this.routes.find((route) => {
      const { filters } = route;

      if (filters.configRuleNames && !filters.configRuleNames.includes(input.configRuleName)) {
        return false;
      }

      if (filters.resourceTypes && input.resourceType) {
        if (!filters.resourceTypes.includes(input.resourceType)) {
          return false;
        }
      }

      if (filters.resourceIds && input.resourceId) {
        if (!filters.resourceIds.includes(input.resourceId)) {
          return false;
        }
      }

      if (filters.configurationItemStatuses && input.configurationItemStatus) {
        if (!filters.configurationItemStatuses.includes(input.configurationItemStatus)) {
          return false;
        }
      }

      // TODO: Support custom filter function here

      return true;
    });
  }

  private validateSchema<T>(data: T, schema: Schema<unknown> | undefined, name: string): T {
    if (!schema || data === undefined) {
      return data;
    }

    const result = schema.safeParse(data);
    if (!result.success) {
      throw new Error(`${name} validation failed`);
    }
    return result.data as T;
  }
}

export function createConfigRouter(): ConfigRouter {
  return new ConfigRouter();
}
