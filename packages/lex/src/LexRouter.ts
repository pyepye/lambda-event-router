import type { Context, LexV2Event, LexV2Result } from 'aws-lambda';

import type { EventTypeRouter } from '@lambda-event-router/base';
import { filterStringMatcher, handleEventWithMiddleware, isObject } from '@lambda-event-router/base';

import type {
  LexDialogCodeHookRouteDefinition,
  LexFulfillmentCodeHookRouteDefinition,
  LexHandler,
  LexMiddleware,
  LexRequest,
  LexRouteDefinition,
  LexRouterOptions,
} from './types.js';

interface RouteBuilder {
  handle(handler: LexHandler): LexRouteDefinition;
}

export function defineRoute(config: {
  filters: LexRouteDefinition['filters'];
  middleware?: LexMiddleware[];
}): RouteBuilder {
  return {
    handle(handler: LexHandler): LexRouteDefinition {
      return { filters: config.filters, middleware: config.middleware, handler };
    },
  };
}

export class LexRouter implements EventTypeRouter<LexV2Event, LexV2Result> {
  private routes: LexRouteDefinition[] = [];
  private middleware: LexMiddleware[] = [];

  constructor(options?: LexRouterOptions) {
    this.middleware = options?.middleware ?? [];
  }

  canHandleEvent(event: unknown): event is LexV2Event {
    if (!isObject(event)) return false;

    const sessionState = event.sessionState;
    if (!isObject(sessionState)) return false;

    const bot = event.bot;
    if (!isObject(bot)) return false;
    if (typeof bot.id !== 'string') return false;

    const interpretations = event.interpretations;
    if (!Array.isArray(interpretations)) return false;

    return typeof event.invocationSource === 'string';
  }

  route(definition: LexRouteDefinition): this {
    this.routes.push(definition);
    return this;
  }

  dialogCodeHook(definition: LexDialogCodeHookRouteDefinition): this {
    return this.route({
      filters: { ...definition.filters, invocationSource: 'DialogCodeHook' },
      middleware: definition.middleware,
      handler: definition.handler as LexHandler,
    });
  }

  fulfillmentCodeHook(definition: LexFulfillmentCodeHookRouteDefinition): this {
    return this.route({
      filters: { ...definition.filters, invocationSource: 'FulfillmentCodeHook' },
      middleware: definition.middleware,
      handler: definition.handler as LexHandler,
    });
  }

  async handleEvent(event: LexV2Event, context: Context): Promise<LexV2Result> {
    const route = await this.matchRoute(event);
    if (!route) {
      const intentName = event.sessionState.intent.name;
      throw new Error(
        `No route matched for Amazon Lex event (intent: ${intentName}, invocationSource: ${event.invocationSource})`,
      );
    }

    const request: LexRequest = {
      intentName: event.sessionState.intent.name,
      slots: event.sessionState.intent.slots,
      invocationSource: event.invocationSource,
      sessionAttributes: event.sessionState.sessionAttributes ?? {},
      inputTranscript: event.inputTranscript,
      bot: event.bot,
      event,
      context,
    };

    const allMiddleware = [...this.middleware, ...(route.middleware ?? [])];
    return handleEventWithMiddleware(allMiddleware, request, route.handler);
  }

  private async matchRoute(event: LexV2Event): Promise<LexRouteDefinition | undefined> {
    for (const route of this.routes) {
      const { filters } = route;

      if (filters.intentName) {
        const intentNameMatch = filterStringMatcher(event.sessionState.intent.name, filters.intentName);
        if (!intentNameMatch) continue;
      }

      if (filters.invocationSource) {
        const { invocationSource: filterSource } = filters;
        const invocationSources = Array.isArray(filterSource) ? filterSource : [filterSource];
        if (!invocationSources.includes(event.invocationSource)) {
          continue;
        }
      }

      if (filters.botId) {
        const botIdMatch = filterStringMatcher(event.bot.id, filters.botId);
        if (!botIdMatch) continue;
      }

      if (filters.inputMode) {
        const inputModes = Array.isArray(filters.inputMode) ? filters.inputMode : [filters.inputMode];
        if (!inputModes.includes(event.inputMode)) {
          continue;
        }
      }

      if (filters.custom) {
        const match = await filters.custom({
          intentName: event.sessionState.intent.name,
          invocationSource: event.invocationSource,
          inputMode: event.inputMode,
          botId: event.bot.id,
          event,
        });
        if (!match) continue;
      }

      return route;
    }

    return undefined;
  }
}

export function createLexRouter(options?: LexRouterOptions): LexRouter {
  return new LexRouter(options);
}
