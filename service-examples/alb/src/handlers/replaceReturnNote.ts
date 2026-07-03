import { gunzipSync } from 'node:zlib';

import { type ApiRequest, type ApiResponse, Ok } from '@lambda-event-router/alb';
import { logger } from '@lambda-event-router/base';

// The note arrives gzipped. ALB base64 encodes a body its content type says is not text, and the
// router hands the decoded bytes over as a Buffer, so gunzip only works on a body that survived
// the trip whole.
export async function replaceReturnNote(
  request: ApiRequest<{ returnId: string }, Record<string, string | undefined>, Buffer>,
): Promise<ApiResponse<{ returnId: string; lines: number; bytes: number; encoded: boolean }>> {
  const note = gunzipSync(request.body).toString('utf-8');
  const lines = note.split('\n').filter((line) => line.length > 0).length;

  logger.info({
    message: 'Return note replaced',
    returnId: request.path.returnId,
    lines,
    bytes: request.body.length,
    isBase64Encoded: request.isBase64Encoded,
    bodyType: request.body.constructor.name,
  });

  return Ok({ returnId: request.path.returnId, lines, bytes: request.body.length, encoded: request.isBase64Encoded });
}
