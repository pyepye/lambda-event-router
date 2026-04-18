import type { EventTypeRouter } from '@lambda-event-router/base';
import { handleEventWithMiddleware, isObject } from '@lambda-event-router/base';
import type { Context, SecretsManagerRotationEvent, SecretsManagerRotationEventStep } from 'aws-lambda';
import type {
  SecretsManagerFilterInput,
  SecretsManagerFilters,
  SecretsManagerHandler,
  SecretsManagerMiddleware,
  SecretsManagerRequest,
  SecretsManagerRouteDefinition,
  SecretsManagerRouterOptions,
  SecretsManagerStepRouteDefinition,
} from './types.js';

const VALID_STEPS: readonly SecretsManagerRotationEventStep[] = [
  'createSecret',
  'setSecret',
  'testSecret',
  'finishSecret',
];

function isValidStep(step: string): step is SecretsManagerRotationEventStep {
  return (VALID_STEPS as readonly string[]).includes(step);
}

interface RouteBuilder {
  handle(handler: SecretsManagerHandler): SecretsManagerRouteDefinition;
}

export function defineRoute(config: {
  filters: SecretsManagerFilters;
  middleware?: SecretsManagerMiddleware[];
}): RouteBuilder {
  return {
    handle(handler: SecretsManagerHandler): SecretsManagerRouteDefinition {
      return { filters: config.filters, middleware: config.middleware ?? [], handler };
    },
  };
}

export class SecretsManagerRouter implements EventTypeRouter<SecretsManagerRotationEvent, undefined> {
  private routes: SecretsManagerRouteDefinition[] = [];
  private middleware: SecretsManagerMiddleware[] = [];

  constructor(options?: SecretsManagerRouterOptions) {
    this.middleware = options?.middleware ?? [];
  }

  canHandleEvent(event: unknown): event is SecretsManagerRotationEvent {
    if (!isObject(event)) return false;
    if (typeof event.SecretId !== 'string') return false;
    if (typeof event.ClientRequestToken !== 'string') return false;
    if (typeof event.Step !== 'string') return false;

    return isValidStep(event.Step);
  }

  route(definition: SecretsManagerRouteDefinition | SecretsManagerStepRouteDefinition): this {
    this.routes.push(definition);
    return this;
  }

  createSecret(definition: SecretsManagerStepRouteDefinition): this {
    return this.route({
      filters: { ...definition.filters, step: 'createSecret' },
      middleware: definition.middleware,
      handler: definition.handler,
    });
  }

  setSecret(definition: SecretsManagerStepRouteDefinition): this {
    return this.route({
      filters: { ...definition.filters, step: 'setSecret' },
      middleware: definition.middleware,
      handler: definition.handler,
    });
  }

  testSecret(definition: SecretsManagerStepRouteDefinition): this {
    return this.route({
      filters: { ...definition.filters, step: 'testSecret' },
      middleware: definition.middleware,
      handler: definition.handler,
    });
  }

  finishSecret(definition: SecretsManagerStepRouteDefinition): this {
    return this.route({
      filters: { ...definition.filters, step: 'finishSecret' },
      middleware: definition.middleware,
      handler: definition.handler,
    });
  }

  async handleEvent(event: SecretsManagerRotationEvent, context: Context): Promise<undefined> {
    const secretId = event.SecretId;
    const clientRequestToken = event.ClientRequestToken;
    const step = event.Step;
    const filterInput: SecretsManagerFilterInput = { secretId, clientRequestToken, step };

    const route = await this.matchRoute(filterInput);
    if (!route) {
      throw new Error(
        `No route matched for Secrets Manager rotation event (step: ${event.Step}, secretId: ${event.SecretId})`,
      );
    }
    const request: SecretsManagerRequest = { ...filterInput, event, context };

    const allMiddleware = [...this.middleware, ...(route.middleware ?? [])];
    await handleEventWithMiddleware(allMiddleware, request, route.handler);
  }

  private async matchRoute(request: SecretsManagerFilterInput): Promise<SecretsManagerRouteDefinition | undefined> {
    const { secretId, step } = request;

    for (const route of this.routes) {
      const { filters } = route;

      if (filters.secretId) {
        const secretIds = Array.isArray(filters.secretId) ? filters.secretId : [filters.secretId];
        if (!secretIds.includes(secretId)) {
          continue;
        }
      }

      if (filters.secretPrefix) {
        const secretPrefixes = Array.isArray(filters.secretPrefix) ? filters.secretPrefix : [filters.secretPrefix];
        const hasMatchingPrefix = secretPrefixes.some((prefix) => secretId.startsWith(prefix));
        if (!hasMatchingPrefix) continue;
      }

      if (filters.secretSuffix) {
        const secretSuffixes = Array.isArray(filters.secretSuffix) ? filters.secretSuffix : [filters.secretSuffix];
        const hasMatchingSuffix = secretSuffixes.some((suffix) => secretId.endsWith(suffix));
        if (!hasMatchingSuffix) continue;
      }

      if (filters.secretIncludes) {
        const { secretIncludes: filterSecretIncludes } = filters;
        const secretIncludes = Array.isArray(filterSecretIncludes) ? filterSecretIncludes : [filterSecretIncludes];
        const hasMatchingIncludes = secretIncludes.some((str) => secretId.includes(str));
        if (!hasMatchingIncludes) continue;
      }

      if (filters.step) {
        const steps = Array.isArray(filters.step) ? filters.step : [filters.step];
        if (!steps.includes(step)) {
          continue;
        }
      }

      if (filters.customFilter) {
        const match = await filters.customFilter(request);
        if (!match) continue;
      }

      return route;
    }

    return undefined;
  }
}

export function createSecretsManagerRouter(options?: SecretsManagerRouterOptions): SecretsManagerRouter {
  return new SecretsManagerRouter(options);
}
