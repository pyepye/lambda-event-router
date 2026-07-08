// The instanceArn filters match against this. CDK injects it as an env var on the worker.
export const CONNECT_INSTANCE_ARN = process.env.CONNECT_INSTANCE_ARN ?? '';
