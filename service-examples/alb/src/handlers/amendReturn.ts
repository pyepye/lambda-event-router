import { type ApiRequest, type ApiResponse, NotFound, Ok } from '@latcher/alb';
import { logger } from '@latcher/base';

import { RETURNS } from '../utils/returns.js';
import type { TReturnAmendment } from '../utils/schemas.js';

export async function amendReturn(
  request: ApiRequest<{ returnId: string }, Record<string, string | undefined>, undefined, TReturnAmendment>,
): Promise<ApiResponse<{ returnId: string; units: number }>> {
  const record = RETURNS[request.path.returnId];
  if (!record) throw NotFound(`Return ${request.path.returnId} does not exist`);

  logger.info({ message: 'Return amended', returnId: record.returnId, units: request.body.units });

  return Ok({ returnId: record.returnId, units: record.units + request.body.units });
}
