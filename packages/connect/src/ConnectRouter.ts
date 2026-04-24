import type { ConnectContactFlowEvent, ConnectContactFlowResult, Context } from 'aws-lambda';

import type { EventTypeRouter } from '@lambda-event-router/base';
import { filterStringMatcher, handleEventWithMiddleware, isObject } from '@lambda-event-router/base';

import type {
  ConnectChannelRouteDefinition,
  ConnectHandler,
  ConnectInitiationMethodRouteDefinition,
  ConnectMiddleware,
  ConnectRequest,
  ConnectRouteDefinition,
  ConnectRouterOptions,
} from './types.js';

interface RouteBuilder {
  handle(handler: ConnectHandler): ConnectRouteDefinition;
}

export function defineRoute(config: {
  filters: ConnectRouteDefinition['filters'];
  middleware?: ConnectMiddleware[];
}): RouteBuilder {
  return {
    handle(handler: ConnectHandler): ConnectRouteDefinition {
      return { filters: config.filters, middleware: config.middleware ?? [], handler };
    },
  };
}

export class ConnectRouter implements EventTypeRouter<ConnectContactFlowEvent, ConnectContactFlowResult> {
  private routes: ConnectRouteDefinition[] = [];
  private middleware: ConnectMiddleware[] = [];

  constructor(options?: ConnectRouterOptions) {
    this.middleware = options?.middleware ?? [];
  }

  canHandleEvent(event: unknown): event is ConnectContactFlowEvent {
    if (!isObject(event)) return false;
    if (event.Name !== 'ContactFlowEvent') return false;

    const details = event.Details;
    if (!isObject(details)) return false;

    return isObject(details.ContactData);
  }

  route(definition: ConnectRouteDefinition): this {
    this.routes.push(definition);
    return this;
  }

  voice(definition: ConnectChannelRouteDefinition): this {
    return this.route({
      filters: { ...definition.filters, channel: 'VOICE' },
      middleware: definition.middleware,
      handler: definition.handler,
    });
  }

  chat(definition: ConnectChannelRouteDefinition): this {
    return this.route({
      filters: { ...definition.filters, channel: 'CHAT' },
      middleware: definition.middleware,
      handler: definition.handler,
    });
  }

  email(definition: ConnectChannelRouteDefinition): this {
    return this.route({
      filters: { ...definition.filters, channel: 'EMAIL' },
      middleware: definition.middleware,
      handler: definition.handler,
    });
  }

  inbound(definition: ConnectInitiationMethodRouteDefinition): this {
    return this.route({
      filters: { ...definition.filters, initiationMethod: 'INBOUND' },
      middleware: definition.middleware,
      handler: definition.handler,
    });
  }

  outbound(definition: ConnectInitiationMethodRouteDefinition): this {
    return this.route({
      filters: { ...definition.filters, initiationMethod: 'OUTBOUND' },
      middleware: definition.middleware,
      handler: definition.handler,
    });
  }

  transfer(definition: ConnectInitiationMethodRouteDefinition): this {
    return this.route({
      filters: { ...definition.filters, initiationMethod: 'TRANSFER' },
      middleware: definition.middleware,
      handler: definition.handler,
    });
  }

  callback(definition: ConnectInitiationMethodRouteDefinition): this {
    return this.route({
      filters: { ...definition.filters, initiationMethod: 'CALLBACK' },
      middleware: definition.middleware,
      handler: definition.handler,
    });
  }

  api(definition: ConnectInitiationMethodRouteDefinition): this {
    return this.route({
      filters: { ...definition.filters, initiationMethod: 'API' },
      middleware: definition.middleware,
      handler: definition.handler,
    });
  }

  async handleEvent(event: ConnectContactFlowEvent, context: Context): Promise<ConnectContactFlowResult> {
    const { ContactData: contactData, Parameters: parameters } = event.Details;

    const route = await this.matchRoute(event);
    if (!route) {
      throw new Error(
        `No route matched for Amazon Connect event (channel: ${contactData.Channel}, initiationMethod: ${contactData.InitiationMethod})`,
      );
    }

    const request: ConnectRequest = { contactData, parameters, event, context };

    const allMiddleware = [...this.middleware, ...(route.middleware ?? [])];
    return handleEventWithMiddleware(allMiddleware, request, route.handler);
  }

  private async matchRoute(event: ConnectContactFlowEvent): Promise<ConnectRouteDefinition | undefined> {
    const { ContactData: contactData } = event.Details;

    for (const route of this.routes) {
      const { filters } = route;

      if (filters.channel) {
        const channels = Array.isArray(filters.channel) ? filters.channel : [filters.channel];
        if (!channels.includes(contactData.Channel)) {
          continue;
        }
      }

      if (filters.initiationMethod) {
        const { initiationMethod: filterMethod } = filters;
        const initiationMethods = Array.isArray(filterMethod) ? filterMethod : [filterMethod];
        if (!initiationMethods.includes(contactData.InitiationMethod)) {
          continue;
        }
      }

      if (filters.instanceArn) {
        const instanceArnMatch = filterStringMatcher(contactData.InstanceARN, filters.instanceArn);
        if (!instanceArnMatch) continue;
      }

      if (filters.customFilter) {
        const match = await filters.customFilter({
          channel: contactData.Channel,
          initiationMethod: contactData.InitiationMethod,
          event,
        });
        if (!match) continue;
      }
      return route;
    }
    return undefined;
  }
}

export function createConnectRouter(options?: ConnectRouterOptions): ConnectRouter {
  return new ConnectRouter(options);
}
