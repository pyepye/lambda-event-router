import { type ApiRequest, type ApiResponse, NotFound, Ok } from '@lambda-event-router/alb';
import { logger } from '@lambda-event-router/base';

import { RETURNS } from '../utils/returns.js';
import type { TReturnAmendment } from '../utils/schemas.js';

export async function amendReturn(
  request: ApiRequest<{ returnId: string }, Record<string, string | undefined>, TReturnAmendment>,
): Promise<ApiResponse<{ returnId: string; units: number }>> {
  const record = RETURNS[request.path.returnId];
  if (!record) throw NotFound({ error: `Return ${request.path.returnId} does not exist` });

  logger.info({ message: 'Return amended', returnId: record.returnId, units: request.body.units });

  return Ok({ returnId: record.returnId, units: record.units + request.body.units });
}
