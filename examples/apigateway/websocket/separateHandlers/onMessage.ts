import type { WebSocketRequest } from '@lambda-event-router/apigateway';
import { postToConnection } from '@lambda-event-router/apigateway';
import { z } from 'zod';

export const SendMessageBodySchema = z.object({
  action: z.literal('sendMessage'),
  roomId: z.string(),
  content: z.string(),
});

type SendMessageBody = z.infer<typeof SendMessageBodySchema>;

// MESSAGE handlers have no return value - AWS ignores responses for messages.
// Use postToConnection() (API Gateway Management API) to send data to clients.
export async function onMessage(request: WebSocketRequest<SendMessageBody>): Promise<void> {
  const { connectionId, domainName, stage, body } = request;
  const { roomId, content } = body;

  console.log(`Message from ${connectionId} in room ${roomId}: ${content}`);

  // Echo the message back to the sender via the Management API
  await postToConnection({
    domainName,
    stage,
    connectionId,
    data: JSON.stringify({ roomId, content, from: connectionId }),
  });
}
