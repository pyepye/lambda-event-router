// The topicArn filters match against these. CDK injects them as env vars on the worker.
export const ORDERS_TOPIC_ARN = process.env.ORDERS_TOPIC_ARN ?? '';
export const INVENTORY_TOPIC_ARN = process.env.INVENTORY_TOPIC_ARN ?? '';
export const DELIVERY_FAILURES_TOPIC_ARN = process.env.DELIVERY_FAILURES_TOPIC_ARN ?? '';
