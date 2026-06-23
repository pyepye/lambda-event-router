import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { z } from 'zod';

// The shape a BASIC_AUTH source access configuration expects, and the shape CDK generates.
const CredentialsSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export type TBrokerCredentials = z.infer<typeof CredentialsSchema>;

export async function readBrokerCredentials(secretId: string): Promise<TBrokerCredentials> {
  // An AWS client with no region fails at the point of use, so read it here and say so plainly.
  const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
  if (!region) {
    throw new Error('Set AWS_REGION or AWS_DEFAULT_REGION to the region the stack was deployed in.');
  }

  const client = new SecretsManagerClient({ region });
  const { SecretString } = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
  if (!SecretString) {
    throw new Error(`Secret ${secretId} holds no string value.`);
  }

  return CredentialsSchema.parse(JSON.parse(SecretString));
}
