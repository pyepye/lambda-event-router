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
    secretId: DATABASE_SECRET_ARN,
    step: 'createSecret',
  },
  handler: handleCreateSecret,
});

secretsManagerRouter.route({
  filters: {
    secretId: DATABASE_SECRET_ARN,
    step: 'setSecret',
  },
  handler: handleSetSecret,
});

// =============================================================================
// Route with secretPrefixes filter
// =============================================================================

// Match all secrets under the prod/database/ path
secretsManagerRouter.route({
  filters: {
    secretPrefix: 'prod/database/',
    step: ['createSecret', 'setSecret', 'testSecret', 'finishSecret'],
  },
  handler: handleDatabaseRotation,
});

// =============================================================================
// Route with secretSuffixes filter
// =============================================================================

// Match all secrets ending with /password or -credentials
secretsManagerRouter.route({
  filters: {
    secretSuffix: ['/password', '-credentials'],
  },
  handler: handleDatabaseRotation,
});

// =============================================================================
// Route with secretIncludes filter
// =============================================================================

// Match any secret containing "redis" in its name/ARN
secretsManagerRouter.route({
  filters: {
    secretIncludes: 'redis',
  },
  handler: handleDatabaseRotation,
});

// =============================================================================
// Convenience methods - pre-set the step filter
// =============================================================================

// .createSecret() is equivalent to .route() with step: 'createSecret'
secretsManagerRouter.createSecret({
  filters: {
    secretId: DATABASE_SECRET_ARN,
    // steps is not valid here - already implied by .createSecret()
  },
  handler: handleCreateSecret,
});

secretsManagerRouter.setSecret({
  filters: {
    secretId: DATABASE_SECRET_ARN,
  },
  handler: handleSetSecret,
});

secretsManagerRouter.testSecret({
  filters: {
    secretId: DATABASE_SECRET_ARN,
  },
  handler: handleTestSecret,
});

secretsManagerRouter.finishSecret({
  filters: {
    secretId: DATABASE_SECRET_ARN,
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
    step: 'createSecret',
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
