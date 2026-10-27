import type { ApiRequest } from '@latcher/alb';
import { logger } from '@latcher/base';

import { RETURNS, type ReturnRecord } from '../utils/returns.js';

// Registered after GET /returns/:returnId and still reached, because a literal segment outranks a
// param. Returns the body on its own, so the matcher picks the 200 and the JSON content type.
export async function listOpenReturns(_request: ApiRequest): Promise<ReturnRecord[]> {
  const open = Object.values(RETURNS).filter((record) => record.state === 'open');

  logger.info({ message: 'Open returns listed', count: open.length });

  return open;
}
