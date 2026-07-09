// Log group and subscription filter names are fixed strings rather than CDK-generated ones, so the
// stack, the route filters and the trigger script can all share them.
export const CHECKOUT_LOG_GROUP = '/ler-example/checkout-api';
export const PAYMENTS_LOG_GROUP = '/ler-example/payments-worker';
export const REFUNDS_LOG_GROUP = '/ler-example/payments-refunds';
export const AUDIT_LOG_GROUP = '/ler-example/audit-trail';
export const LEGACY_LOG_GROUP = '/ler-example/legacy-batch';

// Both payments groups sit behind one wildcard, which is how quarantineDeclinedPayment and
// archivePaymentTraffic claim the pair and then split on the custom filter.
export const PAYMENTS_LOG_GROUP_PATTERN = '/ler-example/payments-*';

export const CHECKOUT_ERRORS_FILTER = 'checkout-errors';
export const CHECKOUT_TRAFFIC_FILTER = 'checkout-traffic';
export const PAYMENTS_TRAFFIC_FILTER = 'payments-traffic';
export const REFUNDS_TRAFFIC_FILTER = 'refunds-traffic';
export const AUDIT_TRAFFIC_FILTER = 'audit-traffic';
export const LEGACY_TRAFFIC_FILTER = 'legacy-traffic';

// The marker quarantineDeclinedPayment's custom filter looks for in a payments log line.
export const DECLINED_PAYMENT_MARKER = 'payment.declined';
