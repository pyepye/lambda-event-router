import { logger } from '@lambda-event-router/base';
import type { FirehoseMiddleware } from '@lambda-event-router/firehose';

// Router middleware: runs once per record, before any route middleware, for both delivery streams.
// `metadata` only carries a shard id on the stream that reads from Kinesis.
export const logRecord: FirehoseMiddleware = async (request, next) => {
  logger.info({
    message: 'Handling Firehose record',
    recordId: request.recordId,
    approximateArrivalTimestamp: request.approximateArrivalTimestamp,
    sourceShardId: request.metadata?.shardId,
  });

  return next(request);
};
