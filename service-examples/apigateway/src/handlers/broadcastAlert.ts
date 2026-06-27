import { postToConnection, type WebSocketMessageRequest } from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

import type { TStockAlert } from '../utils/schemas.js';
import { STOCK } from '../utils/warehouse.js';

// Nothing a message handler returns reaches the client, so the reply goes back over the connection.
export async function broadcastAlert({
  connectionId,
  domainName,
  stage,
  body,
}: WebSocketMessageRequest<TStockAlert>): Promise<void> {
  const quantity = STOCK[body.sku]?.quantity;

  logger.info({ message: 'Stock alert broadcast', sku: body.sku, quantity });

  await postToConnection({
    domainName,
    stage,
    connectionId,
    data: JSON.stringify({ alert: body.message, sku: body.sku, quantity }),
  });
}
