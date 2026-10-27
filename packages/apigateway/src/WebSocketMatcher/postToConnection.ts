import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';

export interface PostToConnectionInput {
  domainName: string;
  stage: string;
  connectionId: string;
  data: string;
  client?: ApiGatewayManagementApiClient;
}

// One client per endpoint, reused across a warm container so a broadcast pays a single handshake.
const clientCache: Map<string, ApiGatewayManagementApiClient> = new Map();

function resolveClient(endpoint: string, client?: ApiGatewayManagementApiClient): ApiGatewayManagementApiClient {
  if (client) return client;

  const cachedClient = clientCache.get(endpoint);
  if (cachedClient) return cachedClient;

  const createdClient = new ApiGatewayManagementApiClient({ endpoint });
  clientCache.set(endpoint, createdClient);
  return createdClient;
}

export async function postToConnection({
  domainName,
  stage,
  connectionId,
  data,
  client,
}: PostToConnectionInput): Promise<void> {
  const endpoint = `https://${domainName}/${stage}`;
  const apiClient = resolveClient(endpoint, client);
  const command = new PostToConnectionCommand({
    ConnectionId: connectionId,
    Data: data,
  });
  await apiClient.send(command);
}
