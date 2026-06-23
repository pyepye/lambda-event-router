import { DeleteSecretCommand, ResourceNotFoundException, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

import { SECRET_NAMES } from '../src/utils/brokers.js';

// An AWS client with no region fails at the point of use, so read it here and say so plainly.
const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;

if (!region) {
  throw new Error('Set AWS_REGION or AWS_DEFAULT_REGION to the region the stack was deployed in.');
}

const client = new SecretsManagerClient({ region });

// CloudFormation deletes a secret with a 30 day recovery window, which keeps the name taken after the
// stack has gone. Forcing the delete releases it for the next deploy.
for (const secretName of Object.values(SECRET_NAMES)) {
  try {
    await client.send(new DeleteSecretCommand({ SecretId: secretName, ForceDeleteWithoutRecovery: true }));
  } catch (error) {
    if (!(error instanceof ResourceNotFoundException)) throw error;
  }
}

console.log(`Purged ${Object.values(SECRET_NAMES).join(' and ')}.`);
