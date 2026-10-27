import { type ApiRequest, type ApiResponse, Ok } from '@latcher/apigateway';
import { logger } from '@latcher/base';

// A registered OPTIONS route answers the preflight itself, ahead of the automatic CORS reply the
// matcher would otherwise send for this path.
export async function describeStockOptions(
  request: ApiRequest<{ sku: string }>,
): Promise<ApiResponse<{ sku: string }>> {
  logger.info({ message: 'Stock options described', sku: request.path.sku });

  return Ok({ sku: request.path.sku }, { Allow: 'GET, HEAD, PUT, PATCH, DELETE, OPTIONS' });
}
