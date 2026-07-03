import { type ApiRequest, type ApiResponse, NotFound, Ok } from '@lambda-event-router/alb';
import { logger } from '@lambda-event-router/base';

import { RETURN_VERSION_HEADER } from '../utils/constants.js';
import { RETURNS, type ReturnRecord } from '../utils/returns.js';

// Builds the same response the GET route does. The router drops the body and keeps the status and
// the headers, so a HEAD answers 200 with nothing in it.
export async function checkReturn(request: ApiRequest<{ returnId: string }>): Promise<ApiResponse<ReturnRecord>> {
  const record = RETURNS[request.path.returnId];
  if (!record) throw NotFound({ error: `Return ${request.path.returnId} does not exist` });

  logger.info({ message: 'Return checked', returnId: record.returnId });

  return Ok(record, { [RETURN_VERSION_HEADER]: '3' });
}
