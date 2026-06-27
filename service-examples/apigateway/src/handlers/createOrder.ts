import { type ApiRequest, type ApiResponse, Created } from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

import type { TNewOrder } from '../utils/schemas.js';
import type { WarehouseOrder } from '../utils/warehouse.js';

// Behind the TOKEN authorizer, so `auth.principalId` is the staff id the token resolved to and
// `auth.context` holds whatever the authorizer attached to it.
export async function createOrder(
  request: ApiRequest<Record<string, never>, Record<string, string | undefined>, TNewOrder>,
): Promise<ApiResponse<WarehouseOrder>> {
  const order: WarehouseOrder = {
    orderId: `ord-${request.body.reference.split('-').pop()}`,
    reference: request.body.reference,
    customer: request.body.customer,
    status: 'pending',
    total: request.body.total,
  };

  logger.info({
    message: 'Order created',
    orderId: order.orderId,
    principalId: request.auth?.principalId,
    authorizerContext: request.auth?.context,
  });

  return Created(order);
}
