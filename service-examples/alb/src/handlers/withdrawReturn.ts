import { type ApiRequest, type ApiResponse, Conflict, NoContent, NotFound } from '@latcher/alb';
import { logger } from '@latcher/base';

import { RETURNS } from '../utils/returns.js';

// A return can only be withdrawn once it holds no units, so one still carrying stock answers 409.
export async function withdrawReturn(request: ApiRequest<{ returnId: string }>): Promise<ApiResponse<undefined>> {
  const record = RETURNS[request.path.returnId];
  if (!record) throw NotFound(`Return ${request.path.returnId} does not exist`);

  if (record.units > 0) {
    throw Conflict(`Return ${record.returnId} still holds ${record.units} units`);
  }

  logger.info({ message: 'Return withdrawn', returnId: record.returnId });

  return NoContent();
}
