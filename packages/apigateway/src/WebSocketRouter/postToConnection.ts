import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';

interface PostToConnectionInput {
  domainName: string;
  stage: string;
  connectionId: string;
  data: string;
}

export async function postToConnection({
  domainName,
  stage,
  connectionId,
  data,
}: PostToConnectionInput): Promise<void> {
  const endpoint = `https://${domainName}/${stage}`;
  const client = new ApiGatewayManagementApiClient({ endpoint });
  const command = new PostToConnectionCommand({
    ConnectionId: connectionId,
    Data: data,
  });
  await client.send(command);
}
