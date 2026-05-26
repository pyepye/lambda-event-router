import type { Mock } from 'vitest';

import type { postToConnection as PostToConnection } from './postToConnection.js';

const mockSend: Mock = vi.fn().mockResolvedValue({});
const mockClientConstructor: Mock = vi.fn();

vi.mock('@aws-sdk/client-apigatewaymanagementapi', () => {
  return {
    ApiGatewayManagementApiClient: class {
      send = mockSend;
      constructor(config: { endpoint: string }) {
        mockClientConstructor(config);
      }
    },
    PostToConnectionCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
  };
});

// Reset the module between tests so each starts with an empty client cache.
async function loadPostToConnection(): Promise<typeof PostToConnection> {
  const module = await import('./postToConnection.js');
  return module.postToConnection;
}

suite('postToConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  test('creates client with correct endpoint', async () => {
    const postToConnection = await loadPostToConnection();

    await postToConnection({
      domainName: 'abc123.execute-api.us-east-1.amazonaws.com',
      stage: 'production',
      connectionId: 'conn-123',
      data: 'hello',
    });

    expect(mockClientConstructor).toHaveBeenCalledExactlyOnceWith({
      endpoint: 'https://abc123.execute-api.us-east-1.amazonaws.com/production',
    });
  });

  test('sends PostToConnectionCommand with correct ConnectionId and Data', async () => {
    const postToConnection = await loadPostToConnection();

    await postToConnection({
      domainName: 'abc123.execute-api.us-east-1.amazonaws.com',
      stage: 'production',
      connectionId: 'conn-456',
      data: '{"message":"hello"}',
    });

    expect(mockSend).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        input: {
          ConnectionId: 'conn-456',
          Data: '{"message":"hello"}',
        },
      }),
    );
  });

  test('reuses one client across repeated calls to the same endpoint', async () => {
    const postToConnection = await loadPostToConnection();
    const connectionIds = ['conn-1', 'conn-2', 'conn-3'];

    for (const connectionId of connectionIds) {
      await postToConnection({
        domainName: 'abc123.execute-api.us-east-1.amazonaws.com',
        stage: 'production',
        connectionId,
        data: 'hello',
      });
    }

    expect(mockClientConstructor).toHaveBeenCalledOnce();
    expect(mockSend).toHaveBeenCalledTimes(connectionIds.length);
  });

  test('builds a separate client per distinct endpoint', async () => {
    const postToConnection = await loadPostToConnection();

    await postToConnection({
      domainName: 'abc123.execute-api.us-east-1.amazonaws.com',
      stage: 'production',
      connectionId: 'conn-1',
      data: 'hello',
    });
    await postToConnection({
      domainName: 'xyz789.execute-api.us-east-1.amazonaws.com',
      stage: 'production',
      connectionId: 'conn-2',
      data: 'hello',
    });

    expect(mockClientConstructor).toHaveBeenCalledTimes(2);
  });

  test('sends through a supplied client and builds none of its own', async () => {
    const postToConnection = await loadPostToConnection();
    const { ApiGatewayManagementApiClient } = await import('@aws-sdk/client-apigatewaymanagementapi');
    const suppliedClient = new ApiGatewayManagementApiClient({ endpoint: 'https://supplied.example.com/dev' });
    mockClientConstructor.mockClear();

    await postToConnection({
      domainName: 'abc123.execute-api.us-east-1.amazonaws.com',
      stage: 'production',
      connectionId: 'conn-1',
      data: 'hello',
      client: suppliedClient,
    });

    expect(mockClientConstructor).not.toHaveBeenCalled();
    expect(mockSend).toHaveBeenCalledOnce();
  });
});
