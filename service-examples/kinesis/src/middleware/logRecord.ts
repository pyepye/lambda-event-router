import { logger } from '@lambda-event-router/base';
import type { KinesisMiddleware } from '@lambda-event-router/kinesis';

// Router middleware: runs once per record, before any route middleware, for both streams.
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
