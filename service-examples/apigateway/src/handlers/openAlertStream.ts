import {
  type WebSocketConnectRequest,
  type WebSocketConnectResponse,
  WebSocketForbidden,
  WebSocketOk,
  WebSocketUnauthorised,
} from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

import { RETIRED_SERVICE_TOKEN } from '../utils/constants.js';

// Only a $connect carries the query string, and only a $connect handler's status code reaches the
// client: a non-2xx refuses the handshake. A returned response and a thrown one both get there.
export async function openAlertStream({
  connectionId,
  queryStringParameters,
}: WebSocketConnectRequest): Promise<WebSocketConnectResponse> {
  const token = queryStringParameters?.token;

  if (!token) {
    logger.info({ message: 'Alert stream refused, no token', connectionId });
    return WebSocketUnauthorised();
  }

  if (token === RETIRED_SERVICE_TOKEN) {
    logger.info({ message: 'Alert stream refused, retired token', connectionId });
    throw WebSocketForbidden();
  }

  logger.info({ message: 'Alert stream opened', connectionId });

  return WebSocketOk();
}
