import { logger } from '@latcher/base';
import type { FirehoseMiddleware } from '@latcher/firehose';

// Matcher middleware: runs once per record, before any route middleware, for both delivery streams.
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
