import type { SecretsManagerRequest, SecretsManagerResponse } from '@lambda-event-router/secretsmanager';

// Handler for the createSecret step
// Creates a new version of the secret in AWSPENDING staging label
export async function handleCreateSecret({
  secretId,
  clientRequestToken,
}: SecretsManagerRequest): Promise<SecretsManagerResponse> {
  console.log(`Creating new secret version for ${secretId} (token: ${clientRequestToken})`);

  // const client = new SecretsManagerClient({});
  // const command = new GetRandomPasswordCommand({ PasswordLength: 32 });
  // const { RandomPassword } = await client.send(command);
  // await client.send(new PutSecretValueCommand({
  //   SecretId: secretId,
  //   ClientRequestToken: clientRequestToken,
  //   SecretString: RandomPassword,
  //   VersionStages: ['AWSPENDING'],
  // }));
}

// Handler for the setSecret step
// Updates the resource (e.g. database) to use the new secret value
export async function handleSetSecret({
  secretId,
  clientRequestToken,
}: SecretsManagerRequest): Promise<SecretsManagerResponse> {
  console.log(`Setting secret for ${secretId} (token: ${clientRequestToken})`);

  // Retrieve the pending secret value
  // const client = new SecretsManagerClient({});
  // const { SecretString } = await client.send(new GetSecretValueCommand({
  //   SecretId: secretId,
  //   VersionId: clientRequestToken,
  //   VersionStage: 'AWSPENDING',
  // }));
  // Update the database password using the new secret
}

// Handler for the testSecret step
// Validates the new secret value works by connecting with it
export async function handleTestSecret({
  secretId,
  clientRequestToken,
}: SecretsManagerRequest): Promise<SecretsManagerResponse> {
  console.log(`Testing secret for ${secretId} (token: ${clientRequestToken})`);

  // Retrieve the pending secret and try to connect
  // const client = new SecretsManagerClient({});
  // const { SecretString } = await client.send(new GetSecretValueCommand({
  //   SecretId: secretId,
  //   VersionId: clientRequestToken,
  //   VersionStage: 'AWSPENDING',
  // }));
  // Attempt a database connection with the new credentials
}

// Handler for the finishSecret step
// Moves the AWSCURRENT staging label to the new secret version
export async function handleFinishSecret({
  secretId,
  clientRequestToken,
}: SecretsManagerRequest): Promise<SecretsManagerResponse> {
  console.log(`Finishing rotation for ${secretId} (token: ${clientRequestToken})`);

  // const client = new SecretsManagerClient({});
  // const { VersionIdsToStages } = await client.send(new DescribeSecretCommand({
  //   SecretId: secretId,
  // }));
  // Find the current version and move the AWSCURRENT label to the new version
  // await client.send(new UpdateSecretVersionStageCommand({
  //   SecretId: secretId,
  //   VersionStage: 'AWSCURRENT',
  //   MoveToVersionId: clientRequestToken,
  //   RemoveFromVersionId: currentVersion,
  // }));
}

// Handler for secrets matching a specific prefix
export async function handleDatabaseRotation({
  secretId,
  step,
}: SecretsManagerRequest): Promise<SecretsManagerResponse> {
  console.log(`Database rotation step ${step} for ${secretId}`);
}

// Handler for custom-filtered rotation events
export async function handleHighPriorityRotation({
  secretId,
  step,
  clientRequestToken,
}: SecretsManagerRequest): Promise<SecretsManagerResponse> {
  console.log(`High-priority rotation: ${step} for ${secretId} (token: ${clientRequestToken})`);
}
