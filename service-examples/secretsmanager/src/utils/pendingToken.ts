import { GetSecretValueCommand, ResourceNotFoundException } from '@aws-sdk/client-secrets-manager';

import { secretsManagerClient } from '../config.js';

// Reads the version a rotation is working on. Secrets Manager stages it as AWSPENDING under the
// event's clientRequestToken, and returns nothing until the createSecret step has written it.
export async function readPendingToken(secretId: string, versionId: string): Promise<string | undefined> {
  try {
    const { SecretString } = await secretsManagerClient.send(
      new GetSecretValueCommand({ SecretId: secretId, VersionId: versionId, VersionStage: 'AWSPENDING' }),
    );

    return SecretString;
  } catch (error) {
    if (error instanceof ResourceNotFoundException) return undefined;
    throw error;
  }
}
