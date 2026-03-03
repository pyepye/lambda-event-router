import { type FirehoseRequest, type FirehoseResponse, Ok } from '@lambda-event-router/firehose';

import type { LogData } from './transformHandler.js';

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
