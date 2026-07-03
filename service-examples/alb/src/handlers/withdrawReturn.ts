import { type ApiRequest, type ApiResponse, Conflict, NoContent, NotFound } from '@lambda-event-router/alb';
import { logger } from '@lambda-event-router/base';

import { RETURNS } from '../utils/returns.js';

// A return can only be withdrawn once it holds no units, so one still carrying stock answers 409.
export async function withdrawReturn(request: ApiRequest<{ returnId: string }>): Promise<ApiResponse<undefined>> {
  const record = RETURNS[request.path.returnId];
  if (!record) throw NotFound({ error: `Return ${request.path.returnId} does not exist` });

  if (record.units > 0) {
    throw Conflict({ error: `Return ${record.returnId} still holds ${record.units} units` });
  }

  logger.info({ message: 'Return withdrawn', returnId: record.returnId });

  return NoContent();
}
