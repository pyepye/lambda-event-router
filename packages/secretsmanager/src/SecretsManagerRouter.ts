import type { EventTypeRouter } from '@lambda-event-router/base';
import { isObject } from '@lambda-event-router/base';
import type { Context, SecretsManagerRotationEvent, SecretsManagerRotationEventStep } from 'aws-lambda';
import type {
  SecretsManagerFilterInput,
  SecretsManagerFilters,
  SecretsManagerHandler,
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

interface RouteBuilder {
  handle(handler: SecretsManagerHandler): SecretsManagerRouteDefinition;
}

export function defineRoute(config: { filters: SecretsManagerFilters }): RouteBuilder {
  return {
    handle(handler: SecretsManagerHandler): SecretsManagerRouteDefinition {
      return { filters: config.filters, handler };
    },
  };
}

export class SecretsManagerRouter implements EventTypeRouter<SecretsManagerRotationEvent, undefined> {
  private routes: SecretsManagerRouteDefinition[] = [];

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
      filters: { ...definition.filters, steps: ['createSecret'] },
      handler: definition.handler,
    });
  }

  setSecret(definition: SecretsManagerStepRouteDefinition): this {
    return this.route({
      filters: { ...definition.filters, steps: ['setSecret'] },
      handler: definition.handler,
    });
  }

  testSecret(definition: SecretsManagerStepRouteDefinition): this {
    return this.route({
      filters: { ...definition.filters, steps: ['testSecret'] },
      handler: definition.handler,
    });
  }

  finishSecret(definition: SecretsManagerStepRouteDefinition): this {
    return this.route({
      filters: { ...definition.filters, steps: ['finishSecret'] },
      handler: definition.handler,
    });
  }

  async handleEvent(event: SecretsManagerRotationEvent, context: Context): Promise<undefined> {
    const secretId = event.SecretId;
    const clientRequestToken = event.ClientRequestToken;
    const step = event.Step;
    const filterInput: SecretsManagerFilterInput = { secretId, clientRequestToken, step };

    const route = this.matchRoute(filterInput);
    if (!route) {
      throw new Error(
        `No route matched for Secrets Manager rotation event (step: ${event.Step}, secretId: ${event.SecretId})`,
      );
    }
    const request: SecretsManagerRequest = { ...filterInput, event, context };
    await route.handler(request);
  }

  private matchRoute(request: SecretsManagerFilterInput): SecretsManagerRouteDefinition | undefined {
    const { secretId, step } = request;

    return this.routes.find((route) => {
      const { filters } = route;

      if (filters.secretIds && !filters.secretIds.includes(secretId)) {
        return false;
      }

      if (filters.secretPrefixes) {
        const hasMatchingPrefix = filters.secretPrefixes.some((prefix) => secretId.startsWith(prefix));
        if (!hasMatchingPrefix) return false;
      }

      if (filters.secretSuffixes) {
        const hasMatchingSuffix = filters.secretSuffixes.some((suffix) => secretId.endsWith(suffix));
        if (!hasMatchingSuffix) return false;
      }

      if (filters.secretIncludes) {
        const hasMatchingIncludes = filters.secretIncludes.some((str) => secretId.includes(str));
        if (!hasMatchingIncludes) return false;
      }

      if (filters.steps && !filters.steps.includes(step)) {
        return false;
      }

      if (filters.customFilter) {
        return filters.customFilter(request);
      }

      return true;
    });
  }
}

export function createSecretsManagerRouter(): SecretsManagerRouter {
  return new SecretsManagerRouter();
}
