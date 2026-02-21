import type { Mock } from 'vitest';

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

import { postToConnection } from './postToConnection.js';

suite('postToConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('creates client with correct endpoint', async () => {
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
});
