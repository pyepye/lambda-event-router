import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { MongoClient } from 'mongodb';

import caBundle from '../../global-bundle.pem';

const secretsClient = new SecretsManagerClient();

let client: MongoClient | undefined;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set, so there is no cluster to connect to.`);
  }
  return value;
}

export async function connectToCluster(): Promise<MongoClient> {
  if (client) {
    return client;
  }

  const secret = await secretsClient.send(new GetSecretValueCommand({ SecretId: requireEnv('CLUSTER_SECRET_ARN') }));
  const { username, password } = JSON.parse(secret.SecretString ?? '{}') as { username: string; password: string };
  const credentials = `${encodeURIComponent(username)}:${encodeURIComponent(password)}`;
  const host = `${requireEnv('CLUSTER_HOST')}:${requireEnv('CLUSTER_PORT')}`;

  // DocumentDB does not implement retryable writes, and its certificate is signed by the Amazon RDS
  // root CA, which is in no default trust store.
  const uri = `mongodb://${credentials}@${host}/?tls=true&replicaSet=rs0&readPreference=primary&retryWrites=false`;

  client = new MongoClient(uri, { ca: caBundle });
  await client.connect();

  return client;
}
