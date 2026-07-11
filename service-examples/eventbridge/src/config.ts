// The bus name is a fixed string rather than a CDK-generated one, so the stack and the trigger
// script share it without passing an output around.
export const EVENT_BUS_NAME = 'ler-example-events';

export const ORDERS_SOURCE = 'ler.orders';
export const SHIPPING_SOURCE = 'ler.shipping';
export const PAYMENTS_SOURCE = 'ler.payments';
export const LEGACY_SOURCE = 'ler.legacy';

// The rule sends every one of these to the worker. The router does the rest of the sorting.
export const RULE_SOURCES = [ORDERS_SOURCE, SHIPPING_SOURCE, PAYMENTS_SOURCE, LEGACY_SOURCE];

export const ORDER_PLACED = 'Order Placed';
export const ORDER_UPDATED = 'Order Updated';
export const SHIPMENT_DISPATCHED = 'Shipment Dispatched';
export const SHIPMENT_DELAYED = 'Shipment Delayed';
export const PAYMENT_CAPTURED = 'Payment Captured';
export const BATCH_COMPLETED = 'Batch Completed';

// EventBridge stamps account and region from the publisher, so the account and region filters can
// only match on these. CDK injects them as env vars on the worker.
export const LOCAL_ACCOUNT_ID = process.env.LOCAL_ACCOUNT_ID ?? '';
export const LOCAL_REGION = process.env.LOCAL_REGION ?? '';

// A partner account forwards its order updates onto the same bus.
export const PARTNER_ACCOUNT_ID = '123456789012';

// Order updates raised in a US region are mirrored rather than applied locally.
export const MIRROR_REGION_PATTERN = 'us-*';

// Shipments carry the ARN of the warehouse holding the stock. `ler` is not a real AWS service, so
// these ARNs are only ever strings for the resource filter to match on.
export const LEEDS_WAREHOUSE_ARN = 'arn:aws:ler:eu-west-2::warehouse/leeds-01';
export const BRISTOL_WAREHOUSE_ARN = 'arn:aws:ler:eu-west-2::warehouse/bristol-02';
export const LEEDS_WAREHOUSE_PATTERN = 'arn:aws:ler:*:*:warehouse/leeds-*';

// Orders at or above this value go to manual review. Amounts are in pence.
export const HIGH_VALUE_THRESHOLD_PENCE = 100_000;
