// The eventSourceArn filters match against these. CDK injects them as env vars on the worker.
export const ORDERS_STREAM_ARN = process.env.ORDERS_STREAM_ARN ?? '';
export const SEARCH_INDEX_STREAM_ARN = process.env.SEARCH_INDEX_STREAM_ARN ?? '';

// The card token chargeCard refuses. Shared with the trigger script so both ends agree on it.
export const DECLINED_CARD_TOKEN = 'tok_declined';
