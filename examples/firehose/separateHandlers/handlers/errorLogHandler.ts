import {
  type FirehoseFilterInput,
  type FirehoseRequest,
  type FirehoseResponse,
  Ok,
} from '@lambda-event-router/firehose';

import type { LogData } from './transformHandler.js';

// data is unknown (decoded but not schema-validated) — narrow before accessing properties
export function isErrorLog({ data }: FirehoseFilterInput): boolean {
  if (typeof data !== 'object' || data === null) return false;
  if (!('level' in data) || typeof data.level !== 'string') return false;
  return data.level === 'ERROR';
}

export async function handleErrorLog(request: FirehoseRequest<LogData>): Promise<FirehoseResponse> {
  const { service, message, timestamp } = request.data;
  const { approximateArrivalTimestamp } = request.record;

  const errorRecord = {
    service,
    message,
    timestamp,
    severity: 'ERROR',
    approximateArrivalTimestamp,
  };

  // Ok(data, { partitionKeys }) for transformed data with dynamic partitioning
  return Ok(errorRecord, { partitionKeys: { service } });
}
