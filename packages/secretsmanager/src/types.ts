import type { Context, SecretsManagerRotationEvent, SecretsManagerRotationEventStep } from 'aws-lambda';

import type { FilterStringMatcher, Middleware } from '@lambda-event-router/base';

// Change case for properties on SecretsManagerRotationEvent
export interface SecretsManagerRequest {
  step: SecretsManagerRotationEvent['Step'];
  secretId: SecretsManagerRotationEvent['SecretId'];
  clientRequestToken: SecretsManagerRotationEvent['ClientRequestToken'];
  event: SecretsManagerRotationEvent;
  context: Context;
}

export type SecretsManagerResponse = undefined;

export type SecretsManagerMiddleware = Middleware<SecretsManagerRequest, void>;

export type SecretsManagerHandler = (request: SecretsManagerRequest) => Promise<SecretsManagerResponse>;

export interface SecretsManagerFilterInput {
  secretId: string;
  clientRequestToken: string;
  step: SecretsManagerRotationEventStep;
}

export interface SecretsManagerFilters {
  secretId?: FilterStringMatcher;
  step?: SecretsManagerRotationEventStep | SecretsManagerRotationEventStep[];
  custom?: (input: SecretsManagerFilterInput) => boolean | Promise<boolean>;
}

export type SecretsManagerStepFilters = Omit<SecretsManagerFilters, 'step'>;

export interface SecretsManagerRouteDefinition {
  filters: SecretsManagerFilters;
  middleware?: SecretsManagerMiddleware[];
  handler: SecretsManagerHandler;
}

export interface SecretsManagerStepRouteDefinition {
  filters: SecretsManagerStepFilters;
  middleware?: SecretsManagerMiddleware[];
  handler: SecretsManagerHandler;
}

export interface SecretsManagerRouterOptions {
  middleware?: SecretsManagerMiddleware[];
}
