import { logger } from '@latcher/base';
import type { KinesisMiddleware } from '@latcher/kinesis';

// Matcher middleware: runs once per record, before any route middleware, for both streams.
export const logRecord: KinesisMiddleware = async (request, next) => {
  logger.info({
    message: 'Handling Kinesis record',
    partitionKey: request.partitionKey,
    sequenceNumber: request.sequenceNumber,
    approximateArrivalTimestamp: request.approximateArrivalTimestamp,
    stream: request.record.eventSourceARN,
  });
  await next(request);
};
