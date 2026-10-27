import { logger } from '@latcher/base';
import type { KafkaMiddleware } from '@latcher/kafka';

// Matcher middleware: runs once per record, before any route middleware, for every topic.
export const logRecord: KafkaMiddleware = async (request, next) => {
  logger.info({
    message: 'Handling Kafka record',
    topic: request.topic,
    partition: request.partition,
    offset: request.offset,
    key: request.key,
    headers: request.headers,
  });
  await next(request);
};
