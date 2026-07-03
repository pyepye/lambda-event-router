import { logger } from '@lambda-event-router/base';
import { type ApiRequest, type ApiResponse, Ok } from '@lambda-event-router/vpclattice';

// The count sheet arrives as an octet stream rather than JSON, so the router hands the handler the
// bytes that were sent. Payload version 1.0 names the flag `is_base64_encoded` and 2.0 names it
// `isBase64Encoded`, and `request.isBase64Encoded` is the same field under either.
export async function replaceStockItem(
  request: ApiRequest<{ sku: string }, Record<string, string | undefined>, Buffer>,
): Promise<ApiResponse<{ sku: string; lines: number }>> {
  const sheet = request.body.toString('utf-8');
  const lines = sheet.split('\n').filter((line) => line.length > 0).length;

  logger.info({
    message: 'Stock count sheet replaced',
    sku: request.path.sku,
    lines,
    bytes: request.body.length,
    isBase64Encoded: request.isBase64Encoded,
  });

  return Ok({ sku: request.path.sku, lines });
}
