import type { Context, SecretsManagerRotationEvent, SecretsManagerRotationEventStep } from 'aws-lambda';

import type { FilterStringMatcher, Middleware } from '@lambda-event-router/base';

// Secrets Manager sends a fourth key that `SecretsManagerRotationEvent` does not type.
// `PutSecretValue` needs it when a rotation assumes a role or crosses accounts.
export interface SecretsManagerEvent extends SecretsManagerRotationEvent {
  RotationToken?: string;
}

// Change case for properties on SecretsManagerEvent. `secretName` is derived, because the event
// carries the secret ARN and nothing else.
export interface SecretsManagerRequest {
  step: SecretsManagerEvent['Step'];
  secretId: SecretsManagerEvent['SecretId'];
  secretName: string;
  clientRequestToken: SecretsManagerEvent['ClientRequestToken'];
  rotationToken: SecretsManagerEvent['RotationToken'];
  event: SecretsManagerEvent;
  context: Context;
}

export type SecretsManagerResponse = undefined;

export type SecretsManagerMiddleware = Middleware<SecretsManagerRequest, void>;

export type SecretsManagerHandler = (request: SecretsManagerRequest) => Promise<SecretsManagerResponse>;

export interface SecretsManagerFilterInput {
  secretId: string;
  secretName: string;
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
