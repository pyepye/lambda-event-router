import {
  DescribeSecretCommand,
  RotateSecretCommand,
  SecretsManagerClient,
  UpdateSecretVersionStageCommand,
} from '@aws-sdk/client-secrets-manager';

import { SECRET_NAMES } from '../src/utils/secrets.js';

// An AWS client with no region fails at the point of use, so read it here and say so plainly.
const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;

if (!region) {
  throw new Error('Set AWS_REGION or AWS_DEFAULT_REGION to the region the stack is deployed in.');
}

const client = new SecretsManagerClient({ region });

// A rotation that fails leaves its AWSPENDING version staged. Clearing the label is what lets this
// script run twice in a row.
async function clearPendingVersion(secretName: string): Promise<void> {
  const { VersionIdsToStages } = await client.send(new DescribeSecretCommand({ SecretId: secretName }));
  const pendingVersionId = Object.entries(VersionIdsToStages ?? {}).find(([, stages]) =>
    stages.includes('AWSPENDING'),
  )?.[0];

  if (!pendingVersionId) return;

  await client.send(
    new UpdateSecretVersionStageCommand({
      SecretId: secretName,
      VersionStage: 'AWSPENDING',
      RemoveFromVersionId: pendingVersionId,
    }),
  );

  console.log(`Cleared a staged AWSPENDING version on ${secretName}.`);
}

for (const secretName of Object.values(SECRET_NAMES)) {
  await clearPendingVersion(secretName);
  await client.send(new RotateSecretCommand({ SecretId: secretName, RotateImmediately: true }));
  console.log(`Rotation started for ${secretName}.`);
}

console.log(`Started ${Object.keys(SECRET_NAMES).length} rotations.`);
