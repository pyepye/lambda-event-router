import { GetSecretValueCommand, ResourceNotFoundException } from '@aws-sdk/client-secrets-manager';

import { secretsManager } from '../config.js';

// Secrets Manager stages the version a rotation works on as AWSPENDING under the clientRequestToken.
// It has no value until the createSecret step writes one.
export async function readPendingSecret(secretId: string, versionId: string): Promise<string | undefined> {
  try {
    const { SecretString } = await secretsManager.send(
      new GetSecretValueCommand({ SecretId: secretId, VersionId: versionId, VersionStage: 'AWSPENDING' }),
    );

    return SecretString;
  } catch (error) {
    if (error instanceof ResourceNotFoundException) return undefined;
    throw error;
  }
}
