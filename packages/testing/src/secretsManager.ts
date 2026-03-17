import type { Context, SecretsManagerRotationEvent } from 'aws-lambda';
import { createMockContext } from './context.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

export type SecretsManagerRotationEventOverrides = Partial<SecretsManagerRotationEvent>;

export interface SecretsManagerHandlerEvent {
  event: SecretsManagerRotationEvent;
  context: Context;
}

export interface CreateSecretsManagerHandlerEventOptions {
  event?: SecretsManagerRotationEventOverrides;
  context?: Partial<Context>;
}

export function createSecretsManagerRotationEvent(
  overrides: SecretsManagerRotationEventOverrides = {},
): SecretsManagerRotationEvent {
  return {
    Step: 'createSecret',
    SecretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret-abc123',
    ClientRequestToken: crypto.randomUUID(),
    ...overrides,
  };
}

export function createSecretsManagerHandlerEvent(
  options: CreateSecretsManagerHandlerEventOptions = {},
): SecretsManagerHandlerEvent {
  const event = createSecretsManagerRotationEvent(options.event);
  const context = createMockContext(options.context);
  return { event, context };
}

export interface SecretsManagerFixtures {
  secretsManagerEvent: (overrides?: SecretsManagerRotationEventOverrides) => SecretsManagerRotationEvent;
  secretsManagerHandlerEvent: (options?: CreateSecretsManagerHandlerEventOptions) => SecretsManagerHandlerEvent;
}

export const secretsManagerFixtures: FixtureMap<SecretsManagerFixtures> = {
  secretsManagerEvent: fixture(createSecretsManagerRotationEvent),
  secretsManagerHandlerEvent: fixture(createSecretsManagerHandlerEvent),
};
