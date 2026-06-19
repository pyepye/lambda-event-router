import type { Context, SecretsManagerRotationEvent } from 'aws-lambda';

import { createMockContext } from './context.js';
import { deepMerge } from './deepMerge.js';
import type { DeepPartial } from './deepPartial.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

// Secrets Manager sends a fourth key that `SecretsManagerRotationEvent` does not type.
export interface SecretsManagerEvent extends SecretsManagerRotationEvent {
  RotationToken?: string;
}

export type SecretsManagerRotationEventOverrides = DeepPartial<SecretsManagerEvent>;

export interface SecretsManagerHandlerEvent {
  event: SecretsManagerEvent;
  context: Context;
}

export interface CreateSecretsManagerHandlerEventOptions {
  event?: SecretsManagerRotationEventOverrides;
  context?: Partial<Context>;
}

export function createSecretsManagerRotationEvent(
  overrides: SecretsManagerRotationEventOverrides = {},
): SecretsManagerEvent {
  const defaults: SecretsManagerEvent = {
    Step: 'createSecret',
    SecretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret-abc123',
    ClientRequestToken: crypto.randomUUID(),
    RotationToken: crypto.randomUUID(),
  };

  return deepMerge(defaults, overrides);
}

export function createSecretsManagerHandlerEvent(
  options: CreateSecretsManagerHandlerEventOptions = {},
): SecretsManagerHandlerEvent {
  const event = createSecretsManagerRotationEvent(options.event);
  const context = createMockContext(options.context);
  return { event, context };
}

export interface SecretsManagerFixtures {
  secretsManagerEvent: (overrides?: SecretsManagerRotationEventOverrides) => SecretsManagerEvent;
  secretsManagerHandlerEvent: (options?: CreateSecretsManagerHandlerEventOptions) => SecretsManagerHandlerEvent;
}

export const secretsManagerFixtures: FixtureMap<SecretsManagerFixtures> = {
  secretsManagerEvent: fixture(createSecretsManagerRotationEvent),
  secretsManagerHandlerEvent: fixture(createSecretsManagerHandlerEvent),
};
