import { setTimeout as sleep } from 'node:timers/promises';

import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { FirehoseClient, PutRecordBatchCommand } from '@aws-sdk/client-firehose';
import { KinesisClient, PutRecordsCommand } from '@aws-sdk/client-kinesis';
import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';

import { BOT_USER_AGENT_MARKER, EVENT_FRESHNESS_MS } from '../src/config.js';

// The three values come from the CDK outputs. Pass them as args or set the env vars.
const clickstreamName = process.argv[2] ?? process.env.CLICKSTREAM_NAME;
const auditStreamArn = process.argv[3] ?? process.env.AUDIT_STREAM_ARN;
const landingBucketName = process.argv[4] ?? process.env.LANDING_BUCKET_NAME;

if (!(clickstreamName && auditStreamArn && landingBucketName)) {
  throw new Error('Usage: pnpm run trigger <clickstreamName> <auditStreamArn> <landingBucketName>');
}

// An AWS client with no region fails at the point of use, so take the region from the ARN rather than
// hoping the shell has one set. The ARN carries the stream name as well.
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

const audit = parseStreamArn(auditStreamArn);

// The stack names the Kinesis stream `<stackName>-audit-events` and the worker `<stackName>-worker`,
// so the stream name carries the log group name too.
const workerLogGroupName = `/aws/lambda/${audit.streamName.replace(/-audit-events$/, '')}-worker`;

const firehoseClient = new FirehoseClient({ region: audit.region });
const kinesisClient = new KinesisClient({ region: audit.region });
const logsClient = new CloudWatchLogsClient({ region: audit.region });
const s3Client = new S3Client({ region: audit.region });

const POLL_INTERVAL_MS = 5_000;
const LOG_WAIT_TIMEOUT_MS = 300_000;
const S3_WAIT_TIMEOUT_MS = 300_000;

// clicks, errors/clicks, audit/tenant=alpha, audit/tenant=beta and errors/audit.
const EXPECTED_OBJECT_COUNT = 5;

const runStartedAt = Date.now();

// A fresh id per run, carried in every payload and logged by every handler, so one run's records are
// easy to pick out of the log.
const runId = runStartedAt.toString(36);

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';

// quarantineBotTraffic matches on this marker, so build the user agent from the same constant.
const BOT_USER_AGENT = `Googlebot/2.1 (+http://www.google.com/${BOT_USER_AGENT_MARKER}.html)`;

const nowIso = (): string => new Date().toISOString();
const staleIso = new Date(runStartedAt - EVENT_FRESHNESS_MS - 60_000).toISOString();

function pageView(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    runId,
    eventType: 'pageView',
    url: 'https://example.com/',
    visitorId: 'visitor-0000',
    userAgent: DEFAULT_USER_AGENT,
    occurredAt: nowIso(),
    ...overrides,
  };
}

function signUp(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    runId,
    eventType: 'signUp',
    email: 'ada@example.com',
    visitorId: 'visitor-0000',
    plan: 'free',
    ...overrides,
  };
}

function auditEvent(tenantId: string, actor: string, action: string): Record<string, unknown> {
  return { runId, tenantId, actor, action, occurredAt: nowIso() };
}

// One batch, so every clickstream record reaches the worker in a single invocation. Five of the eight
// are meant to fail.
const clickstreamRecords: Record<string, unknown>[] = [
  // recordPageView returns Ok() with no data, so Firehose stores the record as it was put.
  pageView({ visitorId: 'visitor-4821', url: 'https://example.com/pricing' }),
  // redactVisitorEmail returns Ok(data), so what lands in S3 is the masked copy.
  signUp({ visitorId: 'visitor-7734', email: 'ada@example.com', plan: 'team' }),
  // dropHealthCheckPing returns Dropped(), so this record reaches neither prefix.
  { runId, eventType: 'healthCheck', source: 'alb' },
  // It claims to be a page view, but quarantineBotTraffic is registered first and its handler throws.
  pageView({ visitorId: 'visitor-0042', userAgent: BOT_USER_AGENT }),
  // Past the freshness window, so recordPageView throws Failed() rather than an error.
  pageView({ visitorId: 'visitor-5150', url: 'https://example.com/docs', occurredAt: staleIso }),
  // Reaches recordPageView, then fails PageViewSchema because there is no url.
  { runId, eventType: 'pageView', visitorId: 'visitor-6600', userAgent: DEFAULT_USER_AGENT, occurredAt: nowIso() },
  // Reaches redactVisitorEmail, then fails SignUpSchema because the email is not one.
  signUp({ visitorId: 'visitor-9001', email: 'ada-at-example-com' }),
  // Nothing reads this event type, and the user agent is not a bot's, so no route matches.
  { runId, eventType: 'ping', userAgent: DEFAULT_USER_AGENT },
];

// Two tenants, so the partition key the handler returns has two S3 prefixes to tell apart. Nothing is
// wrong with any of them, which is how the log shows what a clean pass returns.
const auditRecords: { partitionKey: string; payload: unknown }[] = [
  { partitionKey: 'alpha', payload: auditEvent('alpha', 'ada@example.com', 'roleGranted') },
  { partitionKey: 'alpha', payload: auditEvent('alpha', 'grace@example.com', 'roleRevoked') },
  { partitionKey: 'beta', payload: auditEvent('beta', 'linus@example.com', 'policyChanged') },
];

// Not JSON, so the router hands AuditEventSchema a raw string and the record fails.
const malformedAuditRecord = { partitionKey: 'gamma', payload: `audit ${runId} policyChanged tenant=gamma` };

async function putClickstreamBatch(records: Record<string, unknown>[]): Promise<void> {
  await firehoseClient.send(
    new PutRecordBatchCommand({
      DeliveryStreamName: clickstreamName,
      Records: records.map((record) => ({ Data: Buffer.from(JSON.stringify(record)) })),
    }),
  );
}

async function putAuditEvents(records: { partitionKey: string; payload: unknown }[]): Promise<void> {
  await kinesisClient.send(
    new PutRecordsCommand({
      StreamName: audit.streamName,
      Records: records.map(({ partitionKey, payload }) => ({
        PartitionKey: partitionKey,
        Data: Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload)),
      })),
    }),
  );
}

// Firehose buffers for a minute before it calls the worker, so the run is paced by what the worker has
// logged rather than by a fixed wait.
async function waitForLogLines(phrase: string, count: number): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < LOG_WAIT_TIMEOUT_MS) {
    const response = await logsClient.send(
      new FilterLogEventsCommand({
        logGroupName: workerLogGroupName,
        startTime: runStartedAt,
        filterPattern: `"${phrase}"`,
      }),
    );

    if ((response.events?.length ?? 0) >= count) return;
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(
    `The worker did not log "${phrase}" ${count} times within ${LOG_WAIT_TIMEOUT_MS / 1000}s. ` +
      `Check that ${workerLogGroupName} exists and that both delivery streams are active.`,
  );
}

async function listObjectKeys(): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await s3Client.send(
      new ListObjectsV2Command({ Bucket: landingBucketName, ContinuationToken: continuationToken }),
    );

    for (const object of response.Contents ?? []) {
      if (object.Key) keys.push(object.Key);
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return keys;
}

// Comparing against the keys already there is what lets the trigger run twice without a teardown. A
// timestamp would depend on the local clock agreeing with S3.
async function waitForNewObjects(existingKeys: Set<string>): Promise<string[]> {
  const startedAt = Date.now();
  let newKeys: string[] = [];

  while (Date.now() - startedAt < S3_WAIT_TIMEOUT_MS) {
    newKeys = (await listObjectKeys()).filter((key) => !existingKeys.has(key)).sort();
    if (newKeys.length >= EXPECTED_OBJECT_COUNT) return newKeys;
    await sleep(POLL_INTERVAL_MS);
  }

  console.log(
    `Only ${newKeys.length} of ${EXPECTED_OBJECT_COUNT} objects arrived within ${S3_WAIT_TIMEOUT_MS / 1000}s.`,
  );
  return newKeys;
}

async function printObject(key: string): Promise<void> {
  const object = await s3Client.send(new GetObjectCommand({ Bucket: landingBucketName, Key: key }));
  const body = (await object.Body?.transformToString()) ?? '';

  console.log(`\n${key}`);
  console.log(body.trim());
}

const keysBeforeRun = new Set(await listObjectKeys());

console.log(`Run ${runId}: putting 8 clickstream records and 3 audit events`);
await putClickstreamBatch(clickstreamRecords);
await putAuditEvents(auditRecords);

console.log('Waiting for the clean audit batch to be transformed');
await waitForLogLines('Audit event archived', auditRecords.length);

console.log('Putting the audit event that is not JSON');
await putAuditEvents([malformedAuditRecord]);

console.log('Waiting for all three schema failures');
await waitForLogLines('Data validation failed', 3);

console.log('Waiting for Firehose to write the objects to S3');
const newKeys = await waitForNewObjects(keysBeforeRun);

for (const key of newKeys) {
  await printObject(key);
}

console.log(`\nRun ${runId} done. ${newKeys.length} objects in s3://${landingBucketName}.`);
