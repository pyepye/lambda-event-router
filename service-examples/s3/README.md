# Service example: S3

A deployable CDK app that exercises the `S3Router` end to end. It models a student document vault.
One Lambda handles the notifications from two buckets and the tasks of an S3 Batch job, and the
router does the per-record dispatch.

```
uploads (versioned, ACLs enabled)
├── rejectOversizedUpload        (custom filter: object size over 1 MiB)
├── quarantineExecutable         (route(): eventName list, key regular expression)
├── scanDocument                 (ObjectCreated:Put, key documents/*.pdf and *.docx)
├── notifyReviewer               (ObjectCreated:Put, key reviews/*, always throws)
├── archiveDocument              (ObjectCreated:Put, key archive/*)
├── acceptFormUpload             (ObjectCreated:Post)
├── assembleTranscript           (ObjectCreated:CompleteMultipartUpload)
├── purgeDocumentVersion         (ObjectRemoved:Delete)
├── recordDeleteMarker           (ObjectRemoved:DeleteMarkerCreated)
├── applyRetentionTags           (ObjectTagging:Put)
├── clearRetentionTags           (ObjectTagging:Delete)
├── auditAclChange               (ObjectAcl:Put)
├── beginArchiveRestore          (ObjectRestore:Post)
├── completeArchiveRestore       (ObjectRestore:Completed)
├── expireRestoredCopy           (ObjectRestore:*, so only Delete is left for it)
├── purgeExpiredVersion          (LifecycleExpiration:Delete)
├── recordLifecycleDeleteMarker  (LifecycleExpiration:DeleteMarkerCreated)
└── coolDownLedger               (LifecycleTransition)

reports (versioned)
├── publishReport                (ObjectCreated:Put, matched by bucket alone)
├── archiveReportCopy            (ObjectCreated:Copy)
└── logRemoval                   (ObjectRemoved:*, so only a removal outside uploads reaches it)

batch-ops (no notification configuration)
└── processArchiveTask           (S3 Batch job, one task per invocation)
```

CDK injects the two notification bucket names as env vars, and `src/config.ts` reads them. The
`bucket` filters match against those values. The batch-ops bucket holds the job manifest, the objects
the job works on and the job's completion report. It has no notifications, so the job's own writes
cannot feed back into the worker.

Handlers do their work by logging, so the CloudWatch logs are how you confirm routing. The one
exception is the batch route, which returns a result code to S3 for every task.

## What it covers

One `trigger` writes 22 notification events across the two buckets and then runs an eight task batch
job. Together they hit every filter the router has, both kinds of notification failure and every
result the batch route can return.

| Feature | Where |
| --- | --- |
| `custom` filter | `rejectOversizedUpload` reads the object size off the record |
| `key` filter, string list | `scanDocument` matches `documents/*.pdf` and `documents/*.docx` |
| `key` filter, regular expression | `quarantineExecutable` matches `.exe`, `.bat` and `.sh` |
| `bucket` filter | `scanDocument` and `publishReport` share an event name and differ only by bucket |
| `eventName` filter, list | `quarantineExecutable` takes `ObjectCreated:Put` and `ObjectCreated:Copy` |
| `eventName` filter, wildcard | `rejectOversizedUpload`, `logRemoval` and `expireRestoredCopy` |
| `route()` and `defineRoute` | `quarantineExecutable`, the one form that names its own event name |
| Convenience methods | Every other route, which set the event name for you |
| Router middleware | `logRecord` runs once per record, on both buckets |
| Route middleware | `withDocumentContext` on `scanDocument` |
| Batch middleware | `withBatchContext` on the batch route, which has its own request type |
| ObjectCreated request | `objectSize` and `eTag`, which only the created routes receive |
| ObjectRestore request | `restoreEventData`, which only `ObjectRestore:Completed` carries |
| Filter order | An oversized PDF reaches `rejectOversizedUpload`, registered above `scanDocument` |
| URL-decoded keys | `batch/enrolment 1003 final.json` is read back by the key the router decoded |
| No route matched | `misc/notes.txt` matches nothing and the router throws |
| Handler failure | `notifyReviewer` throws after its middleware has run |
| `Succeeded` | The four ready enrolments, and the locked one once its lock is released |
| `TemporaryFailure` | A locked enrolment, which S3 Batch retries until the trigger releases the lock |
| `PermanentFailure` returned | An enrolment that failed its checksum |
| `PermanentFailure` thrown | `assertArchivable` throws for a withdrawn enrolment |
| A batch task that throws | One manifest key has no object, so the handler's `GetObject` fails |
| `treatMissingKeysAs` | Set on the batch route. The router answers every task, so S3 never applies it |
| `s3:TestEvent` | `recordNotificationSetup` takes the ping, which has no `Records` and no route |

The router has no schemas. Filters and the event shape are the whole of its matching.

S3 sends one record per Lambda invocation, and an S3 Batch job on schema 1.0 sends one task per
invocation. The router loops over records and tasks, but in this example each loop runs once. Several
records in one invocation is covered by the package's unit tests.

Note: `s3:TestEvent` goes to SQS and SNS destinations. A Lambda destination is validated a different
way and receives no ping, so the route is registered for the shape rather than for a line in the log.

Note: `ObjectAcl:Put` only fires where ACLs are enabled, so the uploads bucket sets its object
ownership to `ObjectWriter`. The CDK default turns ACLs off.

Note: only a browser form post produces `ObjectCreated:Post`. `PutObject` reports `ObjectCreated:Put`
whatever the payload, so the trigger signs a POST policy and posts a form.

Note: two convenience methods have no route here. `reducedRedundancyLostObject` fires only when S3
loses an object held in Reduced Redundancy Storage. `intelligentTiering` fires after an object has
gone unread for at least 30 days under Intelligent-Tiering. Neither can be triggered on demand, so
the package's unit tests are what cover them.

## Prerequisites

- AWS account with credentials on the shell
- CDK bootstrap already run for the target account / region
- Node 24 and pnpm installed

## Permissions

`deploy-policy.json` holds the minimum permissions needed to deploy this example and test it. Attach
it to the user or role you run the commands with.

CloudFormation work is done by the CDK bootstrap roles, so the policy only allows assuming those
roles. The rest covers writing the sample objects, creating the batch job and reading the worker
logs. Actions are locked down, resources are not.

Note: the policy assumes the default bootstrap qualifier `hnb659fds`. Change the role and parameter
ARNs if your account uses a custom one.

## Deploy

From this directory:

```bash
pnpm -F @lambda-event-router/service-example-s3 build
pnpm -F @lambda-event-router/service-example-s3 run deploy
```

CDK outputs include `UploadsBucketName`, `ReportsBucketName`, `BatchOpsBucketName`,
`WorkerFunctionArn` and `BatchJobRoleArn`.

## Write sample objects

```bash
pnpm -F @lambda-event-router/service-example-s3 run trigger
```

The script reads the stack outputs itself, so it takes no arguments. Pass a stack name if you deployed
under one other than `ler-example-s3`.

It writes 22 notification events and then creates the batch job. Two notification events are meant to
fail, and three of the eight batch tasks are.

A run takes about seven minutes, nearly all of it the batch job. One enrolment starts locked, so its
task returns `TemporaryFailure`. S3 Batch retries a task like that every six minutes and never gives
up on its own, which would leave the job running for good. The script waits for the worker to log the
first attempt, then rewrites the enrolment as ready, so the retry succeeds and the job ends. It prints
the task counts when it does, so the run is over when the command returns.

Running the trigger twice in a row works with no teardown in between. Every write goes to a versioned
bucket, so a second run adds versions rather than colliding.

Five more events land long after the command returns:

- `ObjectRestore:Completed` follows the restore by three to five hours. The trigger asks for a
  Standard retrieval, which is the cheap tier.
- `LifecycleTransition` and the two `LifecycleExpiration` events follow on the daily lifecycle
  passes, which run at no fixed hour. The transition rule has an age of zero, so it lands on the
  first pass. The expiration rules have an age of one day, so they land on the second. That
  is a little over two days after the write.
- `ObjectRestore:Delete` follows when the restored copy expires. The trigger asks for one day, and
  S3 rounds the expiry up to a midnight UTC, which the `Archive restore finished` line carries as
  `lifecycleRestorationExpiryTime`. The notification lands some hours after that timestamp rather
  than on it.

Leave the stack up and export the log again to see them. The worker's log group keeps seven days.

## Checking the logs

Save the worker logs to a file outside this directory, because `biome check` tries to parse a `.json`
file that sits in it:

```bash
aws logs tail /aws/lambda/ler-example-s3-worker --since 15m --format short > ~/s3-worker.log
```

Lambda retries a failed asynchronous invocation twice, which spreads each failure over about three
minutes from the start of the run. The batch job normally takes longer than that, so the log is
complete when the trigger returns.

Use `aws logs filter-log-events` instead when you want to count lines. It returns real JSON, and
`aws logs tail --format json` does not.

`logRecord` writes one `Handling S3 record` line per record that matched a route. A record that
matched nothing has no line, because router middleware runs after the match.

Twenty records reach a handler and log once each:

- `Document scanned` four times, for `passport.pdf`, `handbook.docx`, `draft.pdf` and
  `superseded.pdf`. Each one is preceded by `Document queued for scanning` from the route middleware.
- `Upload rejected as oversized` for `thesis.pdf`. It matches `scanDocument`'s key filter as well, but
  the size filter is registered first and wins.
- `Executable quarantined` for `installer.exe`.
- `Document stored in the archive` three times, for the Glacier copy and the two lifecycle objects.
- `Form upload accepted` for `photo.jpg`. Its event name is `ObjectCreated:Post`.
- `Transcript assembled` for `2026-intake.csv`. Its `eTag` ends in `-1`, the part count, so it is not
  the MD5 of the object.
- `Retention tags applied` and `Retention tags cleared` for `passport.pdf`.
- `Object ACL change audited` for `passport.pdf`.
- `Document version purged` for `superseded.pdf`, with the version id the delete named.
- `Delete marker recorded` for `draft.pdf`. The version id on that line is the marker's.
- `Archive restore started` for `transcript-2019.csv`.
- `Report published` and `Report copy archived` in the reports bucket.
- `Object removed` for the report deleted from the reports bucket. The two bucket-scoped removal
  routes skip it, so the wildcard catches it.

Two records fail, and each one produces three `ERROR` records:

- `Review service unavailable for reviews/case-4821.json` comes from the handler. That record has a
  `Handling S3 record` line, because the middleware ran before the handler threw.
- `No route matched for record from bucket <uploads>, key misc/notes.txt` comes from the router. That
  record has no `Handling S3 record` line.

Note: an invocation whose handler threw still reports `success` in its `platform.report` line, with no
error field at all. Count the `ERROR` records, which carry `errorType`, `errorMessage` and a
`stackTrace`. Lambda reuses the request id across an asynchronous retry, so counting request ids
undercounts.

The batch job logs `Handling batch task` at least nine times, carrying the task id, the job id and
the decoded key. Eight of those are the eight tasks, and the ninth is the locked enrolment's retry.
S3 Batch retries that task every six minutes until the trigger releases the lock. A slower
release adds an attempt each time:

- `Enrolment archived` five times. Four are the enrolments that were ready, and the fifth is the
  locked one on its retry. One of the five keys holds a space, so the line proves the router decoded
  what S3 Batch sent.
- The locked enrolment's first attempt, the corrupt one and the withdrawn one log the middleware line
  and nothing else. Their result codes go back to S3, not to the log.
- The eighth key has no object behind it, so `GetObject` fails with `The specified key does not
  exist.` and the error leaves the invocation. S3 Batch does not retry that task.

The result codes are in the job's completion report. Read it from the batch-ops bucket:

```bash
aws s3 cp s3://<BatchOpsBucketName>/batch-reports/ ~/s3-batch-report --recursive
```

The report is two CSVs, one for the succeeded tasks and one for the failed, with a `manifest.json`
naming them both. Five rows read `succeeded` and three read `failed`, all three with an error code of
`PermanentFailure`.

The columns are the bucket, the key, the version id, the task status, the HTTP status, the error code
and the result message. That is not the order `manifest.json` states in its `ReportSchema`, which puts
the error code before the HTTP status.

- A succeeded row carries the result string the handler returned, such as `Archived enrolment 1001`.
- A failed row carries the result code in front of it, so `Enrolment 2003 is withdrawn` reads back as
  `PermanentFailure: Enrolment 2003 is withdrawn`.
- The task that threw carries the whole Lambda error, `errorType` and stack trace included.
- The spaced key comes back as `batch/enrolment+1003+final.json`. The report holds it encoded, and the
  handler read the object by the key the router decoded.

Note: `TemporaryFailure` is not in the report, because that task ends up succeeding. What proves it is
the locked enrolment appearing twice in the log, five to six minutes apart.

## Buckets and routes

| Bucket | Notification events | Routes |
| --- | --- | --- |
| `UploadsBucket` | ObjectCreated, ObjectRemoved, ObjectRestore, ObjectTagging, ObjectAcl:Put, LifecycleExpiration, LifecycleTransition | 18 |
| `ReportsBucket` | ObjectCreated, ObjectRemoved | 3 |
| `BatchOpsBucket` | none | The batch route, reached by the job rather than by a notification |

Every configuration covers a whole event type with no key filter. S3 rejects a notification set where
two configurations share an event type and an overlapping key pattern.

Both notification buckets are versioned, which is what makes `ObjectRemoved:Delete` and
`ObjectRemoved:DeleteMarkerCreated` two different events.

The uploads bucket carries two lifecycle rules. `archive/expiring/` expires after a day and its
noncurrent versions a day later. `archive/cooling/` transitions to Glacier immediately.

Note: a new bucket sets `TransitionDefaultMinimumObjectSize` to `all_storage_classes_128K`, so a
lifecycle transition skips any object under 128 KB whatever the storage class. The ledger the trigger
writes is 210 KB for that reason. Expiration has no such floor.

## Iterating

```bash
pnpm -F @lambda-event-router/service-example-s3 diff   # review pending changeset
pnpm -F @lambda-event-router/service-example-s3 watch  # hotswap deploys
pnpm -F @lambda-event-router/service-example-s3 synth  # render template
```

## Tear down

```bash
pnpm -F @lambda-event-router/service-example-s3 destroy
```

The three buckets empty themselves first, and the worker's log group goes with the stack. CDK's own
helper functions leave two log groups behind, one named `ler-example-s3-BucketNotificationsHandler`
and one named `ler-example-s3-CustomS3AutoDeleteObjects`, both with a random suffix. Delete them by
hand if you want the account clean.

Destroy also leaves the two S3 Batch job records. They are history rather than infrastructure, and
S3 ages them out after 90 days.
