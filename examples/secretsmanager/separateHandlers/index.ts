import { LambdaRouter } from '@lambda-event-router/base';
import { createSecretsManagerRouter, type SecretsManagerFilterInput } from '@lambda-event-router/secretsmanager';
import type { Handler } from 'aws-lambda';

import {
  handleCreateSecret,
  handleDatabaseRotation,
  handleFinishSecret,
  handleHighPriorityRotation,
  handleSetSecret,
  handleTestSecret,
} from './handlers/rotationHandlers.js';

const secretsManagerRouter = createSecretsManagerRouter();

const DATABASE_SECRET_ARN = 'arn:aws:secretsmanager:eu-west-1:123456789012:secret:prod/database/password-AbCdEf';

// =============================================================================
// Generic .route() with steps and secretIds filters
// =============================================================================

// Route specific steps for a known secret ARN
secretsManagerRouter.route({
  filters: {
    secretIds: [DATABASE_SECRET_ARN],
    steps: ['createSecret'],
  },
  handler: handleCreateSecret,
});

secretsManagerRouter.route({
  filters: {
    secretIds: [DATABASE_SECRET_ARN],
    steps: ['setSecret'],
  },
  handler: handleSetSecret,
});

// =============================================================================
// Route with secretPrefixes filter
// =============================================================================

// Match all secrets under the prod/database/ path
secretsManagerRouter.route({
  filters: {
    secretPrefixes: ['prod/database/'],
    steps: ['createSecret', 'setSecret', 'testSecret', 'finishSecret'],
  },
  handler: handleDatabaseRotation,
});

// =============================================================================
// Route with secretSuffixes filter
// =============================================================================

// Match all secrets ending with /password or -credentials
secretsManagerRouter.route({
  filters: {
    secretSuffixes: ['/password', '-credentials'],
  },
  handler: handleDatabaseRotation,
});

// =============================================================================
// Route with secretIncludes filter
// =============================================================================

// Match any secret containing "redis" in its name/ARN
secretsManagerRouter.route({
  filters: {
    secretIncludes: ['redis'],
  },
  handler: handleDatabaseRotation,
});

// =============================================================================
// Convenience methods - pre-set the step filter
// =============================================================================

// .createSecret() is equivalent to .route() with steps: ['createSecret']
secretsManagerRouter.createSecret({
  filters: {
    secretIds: [DATABASE_SECRET_ARN],
    // steps is not valid here - already implied by .createSecret()
  },
  handler: handleCreateSecret,
});

secretsManagerRouter.setSecret({
  filters: {
    secretIds: [DATABASE_SECRET_ARN],
  },
  handler: handleSetSecret,
});

secretsManagerRouter.testSecret({
  filters: {
    secretIds: [DATABASE_SECRET_ARN],
  },
  handler: handleTestSecret,
});

secretsManagerRouter.finishSecret({
  filters: {
    secretIds: [DATABASE_SECRET_ARN],
  },
  handler: handleFinishSecret,
});

// =============================================================================
// Custom filter for complex matching logic
// =============================================================================

const HIGH_PRIORITY_SECRETS = ['prod/database/primary', 'prod/api/auth-token'];

function isHighPrioritySecret({ secretId }: SecretsManagerFilterInput): boolean {
  return HIGH_PRIORITY_SECRETS.some((name) => secretId.includes(name));
}

secretsManagerRouter.route({
  filters: {
    steps: ['createSecret'],
    customFilter: isHighPrioritySecret,
  },
  handler: handleHighPriorityRotation,
});

// =============================================================================
// Lambda Router
// =============================================================================

const lambdaRouter = new LambdaRouter({
  routers: [secretsManagerRouter],
});

export const handler: Handler = lambdaRouter.handler();
