import { logger } from '@lambda-event-router/base';
import type { ApiRequest, ApiResponse } from '@lambda-event-router/vpclattice';
import { HTTP_STATUS_CODES } from '@lambda-event-router/vpclattice';

// A registered OPTIONS route wins over the automatic CORS preflight for this path. The CORS
// headers are still added on top of whatever it returns.
export async function describeStockItem(request: ApiRequest<{ sku: string }>): Promise<ApiResponse<undefined>> {
  logger.info({ message: 'Stock item options described', sku: request.path.sku });

  return {
    statusCode: HTTP_STATUS_CODES.NO_CONTENT,
    body: undefined,
    headers: { Allow: 'GET, HEAD, PUT, PATCH, DELETE, OPTIONS' },
  };
}
