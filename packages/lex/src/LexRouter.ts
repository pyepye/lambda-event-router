import type { EventTypeRouter } from '@lambda-event-router/base';
import { isObject } from '@lambda-event-router/base';
import type { Context, LexV2Event, LexV2Result } from 'aws-lambda';
import type {
  LexDialogCodeHookRouteDefinition,
  LexFulfillmentCodeHookRouteDefinition,
  LexHandler,
  LexRequest,
  LexRouteDefinition,
} from './types.js';

interface RouteBuilder {
  handle(handler: LexHandler): LexRouteDefinition;
}

export function defineRoute(config: { filters: LexRouteDefinition['filters'] }): RouteBuilder {
  return {
    handle(handler: LexHandler): LexRouteDefinition {
      return { filters: config.filters, handler };
    },
  };
}

export class LexRouter implements EventTypeRouter<LexV2Event, LexV2Result> {
  private routes: LexRouteDefinition[] = [];

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
      filters: { ...definition.filters, invocationSources: ['DialogCodeHook'] },
      handler: definition.handler as LexHandler,
    });
  }

  fulfillmentCodeHook(definition: LexFulfillmentCodeHookRouteDefinition): this {
    return this.route({
      filters: { ...definition.filters, invocationSources: ['FulfillmentCodeHook'] },
      handler: definition.handler as LexHandler,
    });
  }

  async handleEvent(event: LexV2Event, context: Context): Promise<LexV2Result> {
    const route = this.matchRoute(event);
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

    return route.handler(request);
  }

  private matchRoute(event: LexV2Event): LexRouteDefinition | undefined {
    const intentName = event.sessionState.intent.name;

    return this.routes.find((route) => {
      const { filters } = route;

      if (filters.intentNames && !filters.intentNames.includes(intentName)) {
        return false;
      }

      if (filters.invocationSources && !filters.invocationSources.includes(event.invocationSource)) {
        return false;
      }

      if (filters.botIds && !filters.botIds.includes(event.bot.id)) {
        return false;
      }

      if (filters.inputModes && !filters.inputModes.includes(event.inputMode)) {
        return false;
      }

      if (filters.customFilter) {
        return filters.customFilter({
          intentName,
          invocationSource: event.invocationSource,
          inputMode: event.inputMode,
          botId: event.bot.id,
          event,
        });
      }

      return true;
    });
  }
}

export function createLexRouter(): LexRouter {
  return new LexRouter();
}
