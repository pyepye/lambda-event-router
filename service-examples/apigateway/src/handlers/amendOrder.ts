import { type ApiRequest, type ApiResponse, NoContent } from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

import type { TOrderAmendment } from '../utils/schemas.js';

// The general PATCH route. It shares its method and path with amendOrderOnFloor, so it is only
// reached once that route's custom filter has said no.
export async function amendOrder(
  request: ApiRequest<{ orderId: string }, Record<string, string | undefined>, TOrderAmendment>,
): Promise<ApiResponse<undefined>> {
  logger.info({ message: 'Order amended', orderId: request.path.orderId, status: request.body.status });

  return NoContent();
}
