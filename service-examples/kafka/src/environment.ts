// An absent value would leave a string filter as an empty string, which the router reads as no
// filter at all. Every route would then claim every record. Failing at cold start is louder.
function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set on this function`);
  }
  return value;
}

// The eventSourceArn filter matches against this. CDK injects it on the worker.
export const CLUSTER_ARN = requiredEnvironment('CLUSTER_ARN');

// Every broker in the cluster, comma separated, as GetBootstrapBrokers returns them.
export const BOOTSTRAP_SERVERS = requiredEnvironment('BOOTSTRAP_SERVERS');

const [firstBroker] = BOOTSTRAP_SERVERS.split(',');

if (!firstBroker) {
  throw new Error('BOOTSTRAP_SERVERS holds no broker address');
}

// The bootstrapServer filter matches any one entry of the list on the event, so one address is enough.
export const PRIMARY_BOOTSTRAP_SERVER = firstBroker;
