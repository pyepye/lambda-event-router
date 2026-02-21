import type { WebSocketConnectResponse, WebSocketRequest } from '@lambda-event-router/apigateway';
import { Unauthorised, WebSocketForbidden, WebSocketOk } from '@lambda-event-router/apigateway';

// CONNECT handler as a standalone function.
// Return WebSocketOk() for { statusCode: 200 }, or void (router auto-sends 200).
// Return WebSocketForbidden() for { statusCode: 403 } to reject the connection.
// Throw Unauthorised() for { statusCode: 401 }.
export async function onConnect(request: WebSocketRequest): Promise<WebSocketConnectResponse> {
  const { connectionId, queryStringParameters } = request;
  const token = queryStringParameters?.token;

  if (!token) {
    throw Unauthorised();
  }

  // e.g. verify token and look up user permissions
  const user = { role: 'viewer' };
  const hasAccess = user.role === 'admin';
  if (!hasAccess) {
    return WebSocketForbidden();
  }

  console.log(`Connection ${connectionId} authenticated`);

  return WebSocketOk();
}
