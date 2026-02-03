import type { SecretsManagerRotationEventStep } from 'aws-lambda';

export interface SecretsManagerRequest {
  secretId: string;
  clientRequestToken: string;
  step: SecretsManagerRotationEventStep;
}

export type SecretsManagerResponse = undefined;

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
  handler: SecretsManagerHandler;
}

export interface SecretsManagerStepRouteDefinition {
  filters: SecretsManagerStepFilters;
  handler: SecretsManagerHandler;
}
