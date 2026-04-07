import type { Middleware } from '@lambda-event-router/base';
import type { Context, SecretsManagerRotationEvent, SecretsManagerRotationEventStep } from 'aws-lambda';

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
  secretIds?: string[];
  secretPrefixes?: string[];
  secretSuffixes?: string[];
  secretIncludes?: string[];
  steps?: SecretsManagerRotationEventStep[];
  customFilter?: (input: SecretsManagerFilterInput) => boolean;
}

export type SecretsManagerStepFilters = Omit<SecretsManagerFilters, 'steps'>;

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
