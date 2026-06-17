import { setTimeout as sleep } from 'node:timers/promises';

import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { KinesisClient, PutRecordCommand } from '@aws-sdk/client-kinesis';

import { QUARANTINED_DEVICE_KEY } from '../src/config.js';

// Stream ARNs come from the CDK outputs. Pass them as args or set the env vars.
const ordersStreamArn = process.argv[2] ?? process.env.ORDERS_STREAM_ARN;
const telemetryStreamArn = process.argv[3] ?? process.env.TELEMETRY_STREAM_ARN;

if (!(ordersStreamArn && telemetryStreamArn)) {
  throw new Error('Usage: pnpm run put:records <ordersStreamArn> <telemetryStreamArn>');
}

// A Kinesis client with no region fails at the point of use, so take the region from the ARN rather
// than hoping the shell has one set. The ARN carries the stream name as well.
function parseStreamArn(arn: string): { region: string; streamName: string } {
  const parts = arn.split(':');
  const region = parts[3];
  const resource = parts[5];
  const streamName = resource?.startsWith('stream/') ? resource.slice('stream/'.length) : undefined;

  if (parts[2] !== 'kinesis' || !region || !streamName) {
    throw new Error(
      `Cannot read a region and stream name from "${arn}". Expected arn:aws:kinesis:<region>:<account>:stream/<name>.`,
    );
  }

  return { region, streamName };
}

const orders = parseStreamArn(ordersStreamArn);
const telemetry = parseStreamArn(telemetryStreamArn);

const client = new KinesisClient({ region: orders.region });
const logsClient = new CloudWatchLogsClient({ region: orders.region });

// The stack names the streams `<stackName>-orders` and `<stackName>-telemetry`, and the worker
// `<stackName>-worker`, so the orders ARN carries the log group name too.
const workerLogGroupName = `/aws/lambda/${orders.streamName.replace(/-orders$/, '')}-worker`;

const POLL_INTERVAL_MS = 2_000;
const QUIET_POLLS = 5;
const WAIT_TIMEOUT_MS = 300_000;

const runStartedAt = Date.now();

// A fresh id per run, carried in every payload and logged by every handler, so one run's records are
// easy to pick out of the log.
const runId = runStartedAt.toString(36);

// One record at a time, awaited, and the sequence number kept. PutRecords does not promise to keep the
// order of its entries, and the order is what puts each failing record at the end of its batch.
async function put(streamName: string, partitionKey: string, data: unknown): Promise<string> {
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  const response = await client.send(
    new PutRecordCommand({ StreamName: streamName, PartitionKey: partitionKey, Data: Buffer.from(payload) }),
  );

  if (!response.SequenceNumber) {
    throw new Error(`Kinesis accepted the record on ${partitionKey} without returning a sequence number.`);
  }

  return response.SequenceNumber;
}

// A failing record holds its shard until Lambda gives up on the batch, and every record behind it in
// that batch is discarded with it. So each failing record has to be alone in its own batch, which means
// waiting for the batch in front of it to be finished with before putting the next group.
//
// Waiting a fixed time does not do that. An event source mapping takes up to a minute to start reading
// a stream it has just been attached to, and until it does every group piles into one batch. Read the
// worker's log instead: once the failing sequence number has appeared and then stopped appearing,
// Lambda has run its last attempt and moved past the batch.
async function waitForBatchGivenUp(sequenceNumber: string): Promise<void> {
  const startedAt = Date.now();
  let seen = 0;
  let quiet = 0;

  while (Date.now() - startedAt < WAIT_TIMEOUT_MS) {
    await sleep(POLL_INTERVAL_MS);

    const response = await logsClient.send(
      new FilterLogEventsCommand({
        logGroupName: workerLogGroupName,
        startTime: runStartedAt,
        filterPattern: `"${sequenceNumber}"`,
      }),
    );

    const count = response.events?.length ?? 0;

    if (count > seen) {
      seen = count;
      quiet = 0;
      continue;
    }

    quiet += 1;
    if (seen > 0 && quiet >= QUIET_POLLS) return;
  }

  throw new Error(
    `The worker did not finish with record ${sequenceNumber} within ${WAIT_TIMEOUT_MS / 1000}s. ` +
      `Check that ${workerLogGroupName} exists and that the event source mappings are enabled.`,
  );
}

function order(orderId: string, total: number, currency: 'GBP' | 'EUR'): Record<string, unknown> {
  return { runId, orderId, customer: 'ada@example.com', total, currency };
}

function reading(deviceId: string, metric: 'temperature' | 'humidity', value: number): Record<string, unknown> {
  return { runId, deviceId, metric, value };
}

// Four orders. The first three are handled, and the fourth matches no route. It goes last, because a
// failure discards every record behind it in its batch.
console.log(`Run ${runId}: putting the orders group`);
await put(orders.streamName, 'customer-4821', order('ord-1', 42.5, 'GBP'));
await put(orders.streamName, 'customer-7734', order('ord-2', 1850, 'GBP'));
await put(orders.streamName, 'customer-4821', order('ord-3', 129, 'EUR'));
const noRouteSequence = await put(orders.streamName, 'web-checkout', order('ord-4', 55, 'GBP'));

// Telemetry is a second stream, so it has its own shard and its own invocation. The quarantined device
// goes last for the same reason.
console.log('Putting the telemetry group');
await put(telemetry.streamName, 'device-0117', reading('device-0117', 'temperature', 21.4));
await put(telemetry.streamName, 'device-0204', reading('device-0204', 'humidity', 48));
const quarantinedSequence = await put(
  telemetry.streamName,
  QUARANTINED_DEVICE_KEY,
  reading(QUARANTINED_DEVICE_KEY, 'temperature', 88.1),
);

console.log('Waiting for both batches to be given up on');
await Promise.all([waitForBatchGivenUp(noRouteSequence), waitForBatchGivenUp(quarantinedSequence)]);

// An order with no total. Its partition key sends it to processOrder, where it fails OrderSchema.
console.log('Putting the order with no total');
await put(orders.streamName, 'customer-1102', order('ord-5', 76, 'GBP'));
const badOrderSequence = await put(orders.streamName, 'customer-1102', {
  runId,
  orderId: 'ord-6',
  customer: 'ada@example.com',
  currency: 'GBP',
});

// A reading that is not JSON at all. The router hands the raw string to ReadingSchema, which rejects it.
console.log('Putting the reading that is not JSON');
await put(telemetry.streamName, 'device-0117', reading('device-0117', 'humidity', 51));
const badReadingSequence = await put(telemetry.streamName, 'device-0117', 'device-0117 humidity 51');

console.log('Waiting for both batches to be given up on');
await Promise.all([waitForBatchGivenUp(badOrderSequence), waitForBatchGivenUp(badReadingSequence)]);

console.log(`Run ${runId} done. Six records on the orders stream and five on telemetry.`);
