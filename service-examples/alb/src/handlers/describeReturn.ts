import type { ApiRequest, ApiResponse } from '@lambda-event-router/alb';
import { HTTP_STATUS_CODES } from '@lambda-event-router/alb';
import { logger } from '@lambda-event-router/base';

// A registered OPTIONS route wins over the automatic CORS preflight for this path. The CORS
// headers are still added on top of whatever it returns.
export async function describeReturn(request: ApiRequest<{ returnId: string }>): Promise<ApiResponse<undefined>> {
  logger.info({ message: 'Return options described', returnId: request.path.returnId });

  return {
    statusCode: HTTP_STATUS_CODES.NO_CONTENT,
    body: undefined,
    headers: { Allow: 'GET, HEAD, PATCH, DELETE, OPTIONS' },
  };
}
