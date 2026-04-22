import { z } from 'zod';

import { Dropped, Failed, type FirehoseRequest, type FirehoseResponse, Ok } from '@lambda-event-router/firehose';

export const LogDataSchema = z.object({
  timestamp: z.string(),
  level: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']),
  service: z.string(),
  message: z.string(),
});

export type LogData = z.infer<typeof LogDataSchema>;

const MAX_RECORD_SIZE_BYTES = 1_000_000;

export async function transformLog(request: FirehoseRequest<LogData>): Promise<FirehoseResponse> {
  const { level, service, message, timestamp } = request.data;
  const { awsRequestId } = request.context;
  const { approximateArrivalTimestamp } = request;

  if (level === 'DEBUG') {
    return Dropped();
  }

  const transformedData = {
    ts: timestamp,
    lvl: level,
    svc: service,
    msg: message,
    traceId: awsRequestId,
    ingestionDelayMs: Date.now() - approximateArrivalTimestamp,
  };

  const recordSize = new TextEncoder().encode(JSON.stringify(transformedData)).byteLength;

  if (recordSize > MAX_RECORD_SIZE_BYTES) {
    // Failed() can be thrown - the router catches it and marks the record as failed
    // Unhandled exceptions also automatically return a Failed response in the FirehoseRouter
    throw Failed(`Record exceeds max size: ${recordSize} bytes`);
  }

  // Ok() auto-stringifies objects and base64-encodes the result
  return Ok(transformedData);
}
