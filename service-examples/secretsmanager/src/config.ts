import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

import { SECRET_NAME_PREFIX, SECRET_NAMES } from './utils/secrets.js';

export const secretsManagerClient = new SecretsManagerClient();

// One route matches on the ARN rather than the name. CDK injects it as an env var on the worker.
export const PAYMENTS_TOKEN_ARN = process.env.PAYMENTS_TOKEN_ARN ?? '';

// The router owns the secrets under these paths. Anything else matches no route. Written as names,
// which the secretId filter matches as well as the ARN.
export const MANAGED_SECRET_PATTERNS = [
  `${SECRET_NAME_PREFIX}/payments/*`,
  `${SECRET_NAME_PREFIX}/webhooks/*`,
  `${SECRET_NAME_PREFIX}/search/*`,
];

// Rotating one of these has to verify the pending version before it is promoted.
export const HIGH_RISK_SECRETS: string[] = [SECRET_NAMES.paymentsApiToken];
