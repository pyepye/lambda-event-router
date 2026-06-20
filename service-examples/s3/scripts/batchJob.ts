import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { CreateJobCommand, DescribeJobCommand, S3ControlClient } from '@aws-sdk/client-s3-control';

import { s3Client } from '../src/config.js';
import { resolveRegion, type StackOutputs } from './stack.js';

const MANIFEST_KEY = 'batch/manifest.csv';
const LOCKED_KEY = 'batch/enrolment-2001.json';
const ATTEMPT_POLL_INTERVAL_MS = 5_000;
const ATTEMPT_POLL_LIMIT = 60;
const JOB_POLL_INTERVAL_MS = 15_000;
const JOB_POLL_LIMIT = 80;
const TERMINAL_STATUSES = new Set(['Complete', 'Failed', 'Cancelled', 'Suspended']);

const region = await resolveRegion();
const s3ControlClient = new S3ControlClient({ region });
const logsClient = new CloudWatchLogsClient({ region });

// Each object holds the enrolment the task reads. The last key has no object behind it, so the
// handler's GetObject throws and the error leaves the invocation.
const TASKS: Array<{ key: string; body?: string }> = [
  { key: 'batch/enrolment-1001.json', body: JSON.stringify({ enrolmentId: '1001', status: 'ready' }) },
  { key: 'batch/enrolment-1002.json', body: JSON.stringify({ enrolmentId: '1002', status: 'ready' }) },
  // A space in the key survives only if the router decodes what S3 Batch sends.
  { key: 'batch/enrolment 1003 final.json', body: JSON.stringify({ enrolmentId: '1003', status: 'ready' }) },
  { key: 'batch/enrolment-1004.json', body: JSON.stringify({ enrolmentId: '1004', status: 'ready' }) },
  { key: LOCKED_KEY, body: JSON.stringify({ enrolmentId: '2001', status: 'locked' }) },
  { key: 'batch/enrolment-2002.json', body: JSON.stringify({ enrolmentId: '2002', status: 'corrupt' }) },
  { key: 'batch/enrolment-2003.json', body: JSON.stringify({ enrolmentId: '2003', status: 'withdrawn' }) },
  { key: 'batch/enrolment-2004.json' },
];

// S3 Batch reads manifest keys URL-encoded, and the path separators stay as they are.
function encodeManifestKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// A fixed wait would start before the job does. Waiting on what the worker logged does not.
// Filtering on the job id keeps a previous run's line for the same key out of the answer.
async function waitForFirstAttempt(logGroupName: string, jobId: string, since: number): Promise<void> {
  for (let attempt = 0; attempt < ATTEMPT_POLL_LIMIT; attempt++) {
    const { events } = await logsClient.send(
      new FilterLogEventsCommand({ logGroupName, startTime: since, filterPattern: `"${jobId}"` }),
    );
    if (events?.some((event) => event.message?.includes(LOCKED_KEY))) return;
    await wait(ATTEMPT_POLL_INTERVAL_MS);
  }
  throw new Error(`The batch job did not reach ${LOCKED_KEY} in time.`);
}

export async function runArchiveJob(outputs: StackOutputs): Promise<string> {
  for (const task of TASKS) {
    if (!task.body) continue;
    await s3Client.send(new PutObjectCommand({ Bucket: outputs.batchOpsBucket, Key: task.key, Body: task.body }));
  }

  const manifest = TASKS.map((task) => `${outputs.batchOpsBucket},${encodeManifestKey(task.key)}`).join('\n');
  const { ETag } = await s3Client.send(
    new PutObjectCommand({ Bucket: outputs.batchOpsBucket, Key: MANIFEST_KEY, Body: manifest }),
  );

  // A minute of slack absorbs any drift between this clock and the timestamps CloudWatch records.
  const startedAt = Date.now() - 60_000;
  const { JobId } = await s3ControlClient.send(
    new CreateJobCommand({
      AccountId: outputs.accountId,
      ConfirmationRequired: false,
      Priority: 10,
      RoleArn: outputs.batchJobRoleArn,
      // Schema 1.0 is the default and sends one task per invocation. 2.0 exists for directory
      // buckets and user arguments, and changes the payload the handler receives.
      Operation: { LambdaInvoke: { FunctionArn: outputs.workerFunctionArn, InvocationSchemaVersion: '1.0' } },
      Manifest: {
        Spec: { Format: 'S3BatchOperations_CSV_20180820', Fields: ['Bucket', 'Key'] },
        Location: { ObjectArn: `arn:aws:s3:::${outputs.batchOpsBucket}/${MANIFEST_KEY}`, ETag: ETag ?? '' },
      },
      Report: {
        Enabled: true,
        Bucket: `arn:aws:s3:::${outputs.batchOpsBucket}`,
        Prefix: 'batch-reports',
        Format: 'Report_CSV_20180820',
        ReportScope: 'AllTasks',
      },
    }),
  );

  if (!JobId) throw new Error('S3 Batch returned no job id.');
  console.log(`Batch job ${JobId} created with ${TASKS.length} tasks.`);

  // S3 Batch retries a TemporaryFailure every six minutes and never gives up on its own, so the
  // enrolment has to become archivable. Releasing the lock is what lets the job reach an end state.
  const logGroupName = `/aws/lambda/${outputs.workerFunctionArn.split(':').at(-1)}`;
  await waitForFirstAttempt(logGroupName, JobId, startedAt);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: outputs.batchOpsBucket,
      Key: LOCKED_KEY,
      Body: JSON.stringify({ enrolmentId: '2001', status: 'ready' }),
    }),
  );
  console.log('Released the lock on enrolment 2001. Its retry lands about six minutes later.');

  for (let attempt = 0; attempt < JOB_POLL_LIMIT; attempt++) {
    await wait(JOB_POLL_INTERVAL_MS);
    const { Job } = await s3ControlClient.send(new DescribeJobCommand({ AccountId: outputs.accountId, JobId }));
    const status = Job?.Status ?? 'Unknown';
    if (TERMINAL_STATUSES.has(status)) {
      const summary = Job?.ProgressSummary;
      console.log(
        `Batch job ${JobId} ${status}: ${summary?.NumberOfTasksSucceeded ?? 0} succeeded, ` +
          `${summary?.NumberOfTasksFailed ?? 0} failed.`,
      );
      return JobId;
    }
  }

  throw new Error(
    `Batch job ${JobId} did not finish within ${(JOB_POLL_INTERVAL_MS * JOB_POLL_LIMIT) / 60_000} minutes.`,
  );
}
