import { InvokeCommand, LambdaClient, ListEventSourceMappingsCommand } from '@aws-sdk/client-lambda';

// An AWS client with no region fails at the point of use, so read it here and say so plainly.
const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;

if (!region) {
  throw new Error('Set AWS_REGION or AWS_DEFAULT_REGION to the region the stack was deployed in.');
}

// The function name comes from the CDK outputs. Pass it as an arg or set the env var.
const functionName = process.argv[2] ?? process.env.SEED_FUNCTION_NAME;

if (!functionName) {
  throw new Error('Usage: pnpm seed <seedFunctionName>');
}

const workerName = functionName.replace(/-seed$/, '-worker');

const POLL_INTERVAL_MS = 15_000;
const READY_TIMEOUT_MS = 15 * 60 * 1000;

const client = new LambdaClient({ region });

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// The mappings start from LATEST, so a change written before they are reading is never delivered.
async function waitForMappings(): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const { EventSourceMappings = [] } = await client.send(
      new ListEventSourceMappingsCommand({ FunctionName: workerName }),
    );

    // A mapping reports nothing until its first read. A handler that threw reports a problem and is
    // still reading, so only a missing result means the writes would be lost.
    const pending = EventSourceMappings.filter(
      (mapping) => mapping.State !== 'Enabled' || !mapping.LastProcessingResult,
    );

    if (EventSourceMappings.length > 0 && pending.length === 0) {
      return;
    }

    console.log(`Waiting for ${pending.length} of ${EventSourceMappings.length} mappings to start reading.`);
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(`The mappings on ${workerName} are not reading yet, so a seed run would be lost.`);
}

await waitForMappings();

const response = await client.send(new InvokeCommand({ FunctionName: functionName }));
const payload = response.Payload ? Buffer.from(response.Payload).toString('utf8') : '';

if (response.FunctionError) {
  throw new Error(`The seed run failed: ${payload}`);
}

console.log(payload);
