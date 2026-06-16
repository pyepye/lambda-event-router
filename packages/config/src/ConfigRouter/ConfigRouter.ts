import type { Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { EventTypeRouter } from '@lambda-event-router/base';
import { filterStringMatcher, handleEventWithMiddleware, isObject, validateSchema } from '@lambda-event-router/base';

import type { ConfigEvent, ConfigResponse } from '../types.js';
import type {
  ConfigChangeFilterInput,
  ConfigMiddleware,
  ConfigOversizedRequest,
  ConfigRequest,
  ConfigRouteBuilder,
  ConfigRouteDefinition,
  ConfigRouteInput,
  ConfigRouterOptions,
  ConfigurationItem,
  ConfigurationItemSummary,
  InternalConfigRoute,
  InvokingEvent,
} from './types.js';

export function defineRoute<
  TParamsSchema extends StandardSchemaV1 | undefined = undefined,
  TConfigSchema extends StandardSchemaV1 | undefined = undefined,
  TParams = TParamsSchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TParamsSchema>
    : Record<string, string>,
  TConfig = TConfigSchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TConfigSchema>
    : Record<string, unknown>,
>(config: ConfigRouteInput<TParamsSchema, TConfigSchema, TParams, TConfig>): ConfigRouteBuilder<TConfig, TParams> {
  return {
    handle(
      handler: (request: ConfigRequest<TConfig, TParams> | ConfigOversizedRequest<TParams>) => Promise<void>,
    ): ConfigRouteDefinition<TConfig, TParams> {
      return {
        filters: config.filters,
        ruleParametersSchema: config.ruleParametersSchema as StandardSchemaV1<unknown, TParams> | undefined,
        configurationSchema: config.configurationSchema as StandardSchemaV1<unknown, TConfig> | undefined,
        middleware: config.middleware,
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
  private middleware: ConfigMiddleware[] = [];

  constructor(options?: ConfigRouterOptions) {
    this.middleware = options?.middleware ?? [];
  }

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

  route<TConfig = Record<string, unknown>, TParams = Record<string, string>>(
    definition: ConfigRouteDefinition<TConfig, TParams>,
  ): this {
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

    const route = await this.matchRoute({
      configRuleName: event.configRuleName,
      resourceType,
      resourceId,
      configurationItemStatus,
    });

    if (!route) {
      throw new Error(`No route matched for config rule ${event.configRuleName}`);
    }

    const validatedParams = await validateSchema(
      ruleParameters,
      route.ruleParametersSchema,
      'Schema validation failed for ruleParameters',
    );

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

      const allMiddleware = [...this.middleware, ...(route.middleware ?? [])];
      await handleEventWithMiddleware(allMiddleware, request, handler);

      return;
    }

    const validatedConfiguration = await validateSchema(
      configurationItem?.configuration,
      route.configurationSchema,
      'Schema validation failed for configuration',
    );

    /* v8 ignore next 3 -- @preserve - Non-oversized ConfigurationItemChangeNotification events always have configurationItem */
    if (!configurationItem) {
      throw new Error('configurationItem is required for ConfigurationItemChangeNotification events');
    }

    const itemWithValidatedConfig: ConfigurationItem = {
      ...configurationItem,
      configuration: validatedConfiguration ?? configurationItem.configuration,
    };

    const request: ConfigRequest = {
      configurationItem: itemWithValidatedConfig,
      configurationItemSummary: undefined,
      ruleParameters: validatedParams,
      resultToken: event.resultToken,
      configRuleName: event.configRuleName,
      event,
      context,
    };
    const allMiddleware = [...this.middleware, ...(route.middleware ?? [])];
    await handleEventWithMiddleware(allMiddleware, request, handler);
  }

  private async matchRoute(input: ConfigChangeFilterInput): Promise<InternalConfigRoute | undefined> {
    for (const route of this.routes) {
      const { filters } = route;

      if (filters.configRuleName) {
        const configRuleNameMatch = filterStringMatcher(input.configRuleName, filters.configRuleName);
        if (!configRuleNameMatch) continue;
      }

      if (filters.resourceType) {
        if (!input.resourceType) continue;
        const resourceTypeMatch = filterStringMatcher(input.resourceType, filters.resourceType);
        if (!resourceTypeMatch) continue;
      }

      if (filters.resourceId) {
        if (!input.resourceId) continue;
        const resourceIdMatch = filterStringMatcher(input.resourceId, filters.resourceId);
        if (!resourceIdMatch) continue;
      }

      if (filters.configurationItemStatus) {
        if (!input.configurationItemStatus) continue;
        const configurationItemStatusMatch = filterStringMatcher(
          input.configurationItemStatus,
          filters.configurationItemStatus,
        );
        if (!configurationItemStatusMatch) continue;
      }

      if (filters.custom) {
        const match = await filters.custom(input);
        if (!match) continue;
      }

      return route;
    }

    return undefined;
  }
}

export function createConfigRouter(options?: ConfigRouterOptions): ConfigRouter {
  return new ConfigRouter(options);
}
