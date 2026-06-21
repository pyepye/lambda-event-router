import { DeleteSecretCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

import { CLUSTER_SECRET_NAME } from '../src/utils/cluster.js';

// An AWS client with no region fails at the point of use, so read it here and say so plainly.
const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;

if (!region) {
  throw new Error('Set AWS_REGION or AWS_DEFAULT_REGION to the region the stack was deployed in.');
}

const client = new SecretsManagerClient({ region });

// CloudFormation deletes a secret with a 30 day recovery window, which keeps the name taken after
// the stack has gone. Forcing the delete releases it. A name that is already gone is not an error.
await client.send(new DeleteSecretCommand({ SecretId: CLUSTER_SECRET_NAME, ForceDeleteWithoutRecovery: true }));

console.log(`Purged ${CLUSTER_SECRET_NAME}.`);
