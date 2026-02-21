import { defineWebSocketRoute, postToConnection } from '@lambda-event-router/apigateway';
import { z } from 'zod';

const SendMessageBodySchema = z.object({
  action: z.literal('sendMessage'),
  roomId: z.string(),
  content: z.string(),
});

// MESSAGE handlers have no return value — AWS ignores responses for messages.
// Use postToConnection() (API Gateway Management API) to send data to clients.
export const onSendMessageRoute = defineWebSocketRoute({
  filters: { routeKey: 'sendMessage' },
  bodySchema: SendMessageBodySchema,
}).handle(async (request) => {
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
});
