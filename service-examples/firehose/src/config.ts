// The filters match against these. CDK injects them as env vars on the worker.
export const CLICKSTREAM_ARN = process.env.CLICKSTREAM_ARN ?? '';
export const AUDIT_STREAM_ARN = process.env.AUDIT_STREAM_ARN ?? '';

// A page view older than this is refused rather than stored. The trigger script uses it to build one
// event either side of the line.
export const EVENT_FRESHNESS_MS = 60 * 60 * 1000;

// A user agent holding this is treated as a bot whatever the event claims to be.
export const BOT_USER_AGENT_MARKER = 'bot';
