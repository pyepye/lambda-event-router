import type { EventTypeRouter } from '@lambda-event-router/base';
import { isObject } from '@lambda-event-router/base';
import type { ConnectContactFlowEvent, ConnectContactFlowResult, Context } from 'aws-lambda';
import type {
  AmazonConnectChannelRouteDefinition,
  AmazonConnectHandler,
  AmazonConnectInitiationMethodRouteDefinition,
  AmazonConnectRequest,
  AmazonConnectRouteDefinition,
} from './types.js';

interface RouteBuilder {
  handle(handler: AmazonConnectHandler): AmazonConnectRouteDefinition;
}

export function defineRoute(config: { filters: AmazonConnectRouteDefinition['filters'] }): RouteBuilder {
  return {
    handle(handler: AmazonConnectHandler): AmazonConnectRouteDefinition {
      return { filters: config.filters, handler };
    },
  };
}

export class AmazonConnectRouter implements EventTypeRouter<ConnectContactFlowEvent, ConnectContactFlowResult> {
  private routes: AmazonConnectRouteDefinition[] = [];

  canHandleEvent(event: unknown): event is ConnectContactFlowEvent {
    if (!isObject(event)) return false;
    if (event.Name !== 'ContactFlowEvent') return false;

    const details = event.Details;
    if (!isObject(details)) return false;

    return isObject(details.ContactData);
  }

  route(definition: AmazonConnectRouteDefinition): this {
    this.routes.push(definition);
    return this;
  }

  voice(definition: AmazonConnectChannelRouteDefinition): this {
    return this.route({
      filters: { ...definition.filters, channels: ['VOICE'] },
      handler: definition.handler,
    });
  }

  chat(definition: AmazonConnectChannelRouteDefinition): this {
    return this.route({
      filters: { ...definition.filters, channels: ['CHAT'] },
      handler: definition.handler,
    });
  }

  email(definition: AmazonConnectChannelRouteDefinition): this {
    return this.route({
      filters: { ...definition.filters, channels: ['EMAIL'] },
      handler: definition.handler,
    });
  }

  inbound(definition: AmazonConnectInitiationMethodRouteDefinition): this {
    return this.route({
      filters: { ...definition.filters, initiationMethods: ['INBOUND'] },
      handler: definition.handler,
    });
  }

  outbound(definition: AmazonConnectInitiationMethodRouteDefinition): this {
    return this.route({
      filters: { ...definition.filters, initiationMethods: ['OUTBOUND'] },
      handler: definition.handler,
    });
  }

  transfer(definition: AmazonConnectInitiationMethodRouteDefinition): this {
    return this.route({
      filters: { ...definition.filters, initiationMethods: ['TRANSFER'] },
      handler: definition.handler,
    });
  }

  callback(definition: AmazonConnectInitiationMethodRouteDefinition): this {
    return this.route({
      filters: { ...definition.filters, initiationMethods: ['CALLBACK'] },
      handler: definition.handler,
    });
  }

  api(definition: AmazonConnectInitiationMethodRouteDefinition): this {
    return this.route({
      filters: { ...definition.filters, initiationMethods: ['API'] },
      handler: definition.handler,
    });
  }

  async handleEvent(event: ConnectContactFlowEvent, _context: Context): Promise<ConnectContactFlowResult> {
    const { ContactData: contactData, Parameters: parameters } = event.Details;

    const route = this.matchRoute(event);
    if (!route) {
      throw new Error(
        `No route matched for Amazon Connect event (channel: ${contactData.Channel}, initiationMethod: ${contactData.InitiationMethod})`,
      );
    }

    const request: AmazonConnectRequest = { contactData, parameters };

    return route.handler(request);
  }

  private matchRoute(event: ConnectContactFlowEvent): AmazonConnectRouteDefinition | undefined {
    const { ContactData: contactData } = event.Details;

    return this.routes.find((route) => {
      const { filters } = route;

      if (filters.channels && !filters.channels.includes(contactData.Channel)) {
        return false;
      }

      if (filters.initiationMethods && !filters.initiationMethods.includes(contactData.InitiationMethod)) {
        return false;
      }

      if (filters.instanceArns && !filters.instanceArns.includes(contactData.InstanceARN)) {
        return false;
      }

      if (filters.customFilter) {
        return filters.customFilter({
          channel: contactData.Channel,
          initiationMethod: contactData.InitiationMethod,
          event,
        });
      }

      return true;
    });
  }
}

export function createAmazonConnectRouter(): AmazonConnectRouter {
  return new AmazonConnectRouter();
}
