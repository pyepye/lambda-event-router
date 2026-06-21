// The eventSourceArn filters match against this. CDK injects it as an env var on the worker.
export const CLUSTER_ARN = process.env.CLUSTER_ARN ?? '';
