// The eventSourceArn filters match against these. CDK injects them as env vars on the worker.
export const ORDERS_STREAM_ARN = process.env.ORDERS_STREAM_ARN ?? '';
export const TELEMETRY_STREAM_ARN = process.env.TELEMETRY_STREAM_ARN ?? '';

// An order at or above this total is escalated rather than fulfilled. The custom filter reads it, and
// the trigger script uses it to pick totals either side of the line.
export const HIGH_VALUE_TOTAL = 1000;

// The device the telemetry pipeline refuses to accept readings from. Shared with the trigger script so
// both ends agree on it.
export const QUARANTINED_DEVICE_KEY = 'device-0042';
