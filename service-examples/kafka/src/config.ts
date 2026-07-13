// Values the stack, the worker and the producer all need. The CDK stack imports this file, so
// nothing here may read the worker's environment.

export const WORKER_FUNCTION_NAME = 'ler-example-kafka-worker';
export const PRODUCER_FUNCTION_NAME = 'ler-example-kafka-producer';

export const ORDERS_TOPIC = 'orders';
export const PAYMENTS_TOPIC = 'payments';

// Lambda writes a record here once it has used its retries. Nothing produces to it directly.
export const FAILED_RECORDS_TOPIC = 'failed-records';

// The sample messages address partitions by number, so every topic needs at least this many.
export const TOPIC_PARTITIONS = 3;

export const BROKER_COUNT = 2;

// Header names the custom filters read.
export const EVENT_TYPE_HEADER = 'eventType';
export const PRIORITY_HEADER = 'priority';
export const PAYMENT_KIND_HEADER = 'kind';

export const ORDER_CREATED = 'created';
export const ORDER_CANCELLED = 'cancelled';
export const URGENT_PRIORITY = 'urgent';
export const CAPTURE_KIND = 'capture';
export const REFUND_KIND = 'refund';
