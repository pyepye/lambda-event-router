import type { Context, SecretsManagerRotationEventStep } from 'aws-lambda';

import type { EventTypeMatcher } from '@latcher/base';
import { filterStringMatcher, handleEventWithMiddleware, isObject, orderRoutesBySpecificity } from '@latcher/base';

import type {
  SecretsManagerEvent,
  SecretsManagerFilterInput,
  SecretsManagerFilters,
  SecretsManagerHandler,
  SecretsManagerMatcherOptions,
  SecretsManagerMiddleware,
  SecretsManagerRequest,
  SecretsManagerRouteDefinition,
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

function secretNameFromId(secretId: string): string {
  if (!secretId.startsWith('arn:')) return secretId;
  const resource = secretId.split(':').slice(6).join(':');
  return resource.replace(/-[A-Za-z0-9]{6}$/, '');
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

export class SecretsManagerMatcher implements EventTypeMatcher<SecretsManagerEvent, undefined> {
  private routes: SecretsManagerRouteDefinition[] = [];
  private routesOrdered = false;
  private middleware: SecretsManagerMiddleware[] = [];

  constructor(options?: SecretsManagerMatcherOptions) {
    this.middleware = options?.middleware ?? [];
  }

  canHandleEvent(event: unknown): event is SecretsManagerEvent {
    if (!isObject(event)) return false;
    if (typeof event.SecretId !== 'string') return false;
    if (typeof event.ClientRequestToken !== 'string') return false;
    if (typeof event.Step !== 'string') return false;

    return isValidStep(event.Step);
  }

  route(definition: SecretsManagerRouteDefinition | SecretsManagerStepRouteDefinition): this {
    this.routes.push(definition);
    this.routesOrdered = false;
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

  async handleEvent(event: SecretsManagerEvent, context: Context): Promise<undefined> {
    const secretId = event.SecretId;
    const secretName = secretNameFromId(secretId);
    const clientRequestToken = event.ClientRequestToken;
    const step = event.Step;
    const filterInput: SecretsManagerFilterInput = { secretId, secretName, clientRequestToken, step };

    const route = await this.matchRoute(filterInput);
    if (!route) {
      throw new Error(
        `No route matched for Secrets Manager rotation event (step: ${event.Step}, secretId: ${event.SecretId})`,
      );
    }
    const request: SecretsManagerRequest = { ...filterInput, rotationToken: event.RotationToken, event, context };

    const allMiddleware = [...this.middleware, ...(route.middleware ?? [])];
    await handleEventWithMiddleware(allMiddleware, request, route.handler);
  }

  private orderRoutes(): void {
    if (this.routesOrdered) return;

    this.routes = orderRoutesBySpecificity(this.routes);
    this.routesOrdered = true;
  }

  private async matchRoute(request: SecretsManagerFilterInput): Promise<SecretsManagerRouteDefinition | undefined> {
    const { secretId, secretName, step } = request;

    this.orderRoutes();

    for (const route of this.routes) {
      const { filters } = route;

      if (filters.secretId !== undefined) {
        // The event carries the ARN, so a filter written as the secret name has to match as well.
        const secretIdMatch =
          filterStringMatcher(secretId, filters.secretId) || filterStringMatcher(secretName, filters.secretId);
        if (!secretIdMatch) continue;
      }

      if (filters.step !== undefined) {
        const steps = Array.isArray(filters.step) ? filters.step : [filters.step];
        if (!steps.includes(step)) continue;
      }

      if (filters.custom) {
        const match = await filters.custom(request);
        if (!match) continue;
      }

      return route;
    }

    return undefined;
  }
}

export function createSecretsManagerMatcher(options?: SecretsManagerMatcherOptions): SecretsManagerMatcher {
  return new SecretsManagerMatcher(options);
}
