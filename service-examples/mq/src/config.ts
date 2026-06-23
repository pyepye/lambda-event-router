// The eventSourceArn filters match against these. CDK injects each broker ARN as an env var on the
// worker that reads it.
export const ORDER_BROKER_ARN = process.env.ORDER_BROKER_ARN ?? '';
export const PAYMENT_BROKER_ARN = process.env.PAYMENT_BROKER_ARN ?? '';

// The brokers the orders and payments teams are migrating off. Nothing points an event source
// mapping at either one, so a route that filters on them can never match.
export const LEGACY_ORDER_BROKER_ARN = 'arn:aws:mq:*:*:broker:legacy-orders:*';
export const LEGACY_PAYMENT_BROKER_ARN = 'arn:aws:mq:*:*:broker:legacy-payments:*';

// The virtual host the settlement queues will move to. The broker only serves the default host, so
// a route filtered on this one never matches either.
export const SETTLEMENT_VIRTUAL_HOST = 'settlement';

export const DEFAULT_VIRTUAL_HOST = '/';
