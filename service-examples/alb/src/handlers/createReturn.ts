import { type ApiRequest, type ApiResponse, Conflict, Created } from '@latcher/alb';
import { logger } from '@latcher/base';

import { RETURNS, type ReturnRecord } from '../utils/returns.js';
import type { TNewReturn } from '../utils/schemas.js';

export async function createReturn(
  request: ApiRequest<Record<string, string>, Record<string, string | undefined>, undefined, TNewReturn>,
): Promise<ApiResponse<ReturnRecord>> {
  const { returnId, orderId, units } = request.body;
  if (RETURNS[returnId]) throw Conflict(`Return ${returnId} already exists`);

  logger.info({ message: 'Return created', returnId, units });

  return Created({ returnId, orderId, carrier: 'dpd', units, state: 'open' as const });
}
