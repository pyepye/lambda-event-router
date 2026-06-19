# Service example: Firehose

A deployable CDK app that exercises the `FirehoseRouter` end to end. It models a clickstream and an
audit trail. One Lambda transforms records for two delivery streams, and the router does the
per-record dispatch.

```
clickstream (direct put)
├── dropHealthCheckPing   (custom filter: eventType healthCheck, returns Dropped)
├── quarantineBotTraffic  (custom filter: a bot user agent, always throws)
├── redactVisitorEmail    (custom filter: eventType signUp, returns Ok with new data)
└── recordPageView        (custom filter: eventType pageView, returns Ok with no data)

audit-trail (reads the audit-events Kinesis stream)
└── archiveAuditEvent     (sourceKinesisStreamArn filter, returns Ok with partition keys)
```

Both delivery streams write to one S3 bucket. An `Ok` record lands in the data prefix and a
`ProcessingFailed` record lands in the error prefix. A dropped record lands in neither. The bucket and
the worker's log are the two places to check.

## What it covers

One `trigger` puts 12 records across the two streams. Together they hit every filter the router has,
every result it can return and every failure path.

| Feature | Where |
| --- | --- |
| `deliveryStreamArn` filter | The four clickstream routes match the delivery stream by ARN |
| `sourceKinesisStreamArn` filter | `archiveAuditEvent` matches the Kinesis stream the audit trail reads |
| `custom` filter | The clickstream routes read the event type and the user agent off the decoded record |
| Zod schemas | `dataSchema` on `redactVisitorEmail`, `recordPageView` and `archiveAuditEvent` |
| Router middleware | `logRecord` runs once per record, on both streams |
| Route middleware | `withVisitorContext` on `redactVisitorEmail`, typed to the route's data |
| Lambda middleware | `logTransformationResult` logs what the router hands back to Firehose |
| `Ok()` with no data | `recordPageView` keeps the record as it was put |
| `Ok(data)` | `redactVisitorEmail` replaces the record with the masked copy |
| `Ok(data, metadata)` | `archiveAuditEvent` returns the tenant as a Firehose partition key |
| `Dropped()` | `dropHealthCheckPing` discards the load balancer's ping |
| A thrown response | `recordPageView` throws `Failed()` for an event past the freshness window |
| Filter order | A page view with a bot user agent reaches `quarantineBotTraffic`, registered first |
| A batch with nothing wrong | The three audit events |
| No route matched | An event whose type nothing reads |
| Handler failure | `quarantineBotTraffic` throws |
| Schema failures | A page view with no url, a sign up with a bad email, and an audit event that is not JSON |

Firehose carries raw bytes. The router base64 decodes each record and then parses it as JSON. A
payload that is not JSON is not rejected at that point. It reaches the schema as a raw string.

Filters run before the schemas and read the decoded record, so they guard the shape themselves.
`src/utils/events.ts` holds the two readers the clickstream routes share.

CDK injects the clickstream ARN and the Kinesis stream ARN as env vars, and `src/config.ts` reads
them. The two ARN filters match against those values.

## Prerequisites

- AWS account with credentials on the shell
- CDK bootstrap already run for the target account / region
- Node 24 and pnpm installed

## Permissions

`deploy-policy.json` holds the minimum permissions needed to deploy this example and test it. Attach
it to the user or role you run the commands with.

CloudFormation work is done by the CDK bootstrap roles, so the policy only allows assuming those
roles. The rest covers putting the sample records, reading the worker logs, and reading and emptying
the landing bucket. Actions are locked down, resources are not.

Note: the policy assumes the default bootstrap qualifier `hnb659fds`. Change the role and parameter
ARNs if your account uses a custom one.

## Deploy

From this directory:

```bash
pnpm -F @lambda-event-router/service-example-firehose build
pnpm -F @lambda-event-router/service-example-firehose run deploy
```

CDK outputs include `ClickstreamName`, `AuditStreamArn` and `LandingBucketName`.

## Send sample records

Pass the three values from the deploy outputs:

```bash
pnpm -F @lambda-event-router/service-example-firehose run trigger \
  <ClickstreamName> <AuditStreamArn> <LandingBucketName>
```

That is 12 records. Eight go to the clickstream in one put, and four are audit events. Six are meant
to fail.

The eight clickstream records go as a single `PutRecordBatch`, so they reach the worker in one
invocation. Filter order and a mixed set of results only show up when several records are transformed
together. Firehose hands them over in a different order than they were put, so read the log by what
each line says rather than by where it sits.

The audit events go in two groups. The first three are clean and arrive together, so one invocation of
the run holds nothing but successes. The fourth is put once those three have been transformed, so its
schema failure is an invocation of its own.

Firehose waits a minute for more records before it calls the worker. It waits another minute before it
writes to S3. A run takes about three minutes. The script paces itself on what the worker has logged
rather than on a fixed wait. It then waits for the objects and prints each one.

Every payload carries a fresh run id, so every object in the bucket says which run wrote it. No
handler logs it, so in the worker log the timestamps are what tell one run from the next.

Running the trigger twice in a row works with no teardown in between. It compares the bucket against
what was in it beforehand.

Five objects land in the bucket:

- `clicks/<yyyy>/<mm>/<dd>/<hh>/...` holds two records. The page view is byte for byte what was put,
  because `recordPageView` returns `Ok()` with no data. The sign up reads `redacted@example.com`,
  because `redactVisitorEmail` returns `Ok(data)` and Firehose stores what the handler returned.
- `errors/clicks/processing-failed/<yyyy>/<mm>/<dd>/<hh>/...` holds the five failed clickstream
  records. Firehose wraps each one, and `errorCode` reads `Lambda.ProcessingFailedStatus` for all
  five. `rawData` is the original record in base64, so you can tell them apart, and `attemptsMade`
  reads 1.
- `audit/tenant=alpha/...` holds two records and `audit/tenant=beta/...` holds one. Nothing in the
  record decides that. The prefix comes from the partition key `archiveAuditEvent` returned as
  metadata. A dynamic prefix replaces the date path rather than sitting in front of it.
- `errors/audit/processing-failed/<yyyy>/<mm>/<dd>/<hh>/...` holds the audit record that is not JSON.

Note: nothing in the bucket refers to the health check ping. A dropped record reaches neither prefix,
so its absence is the only evidence of it.

Note: an object holding two records reads as two JSON documents in a row. Firehose writes them back to
back with no separator.

## Checking the logs

Save the worker logs to a file:

```bash
aws logs tail /aws/lambda/ler-example-firehose-worker --since 15m --format short > worker.log
```

Widen the window with `--since`, which takes a single unit such as `30m`, `2h` or `1d`. The worker
logs in JSON, so `--format json` pretty prints the fields. The trigger only exits once the last
record has been transformed, so there is nothing to wait for afterwards.

Note: the log group is `/aws/lambda/<stackName>-worker`, so the name changes if you deploy with a
different `stackName`.

One run produces three invocations and three `Transformation result returned` lines. Each one lists
every record of that invocation with the result the router chose for it.

There are 8 `Handling Firehose record` lines rather than 12. A record that matches no route, or fails
its schema, never gets one. The router matches and validates before it runs middleware.

On the audit records that line carries a `sourceShardId`. Firehose only fills in the record metadata
when it is reading a Kinesis stream, so the clickstream records have none.

The clickstream invocation returns two `Ok`, one `Dropped` and five `ProcessingFailed`:

- `Page view recorded` for `visitor-4821`.
- `Sign up received` then `Sign up redacted` for `visitor-7734`. The first line is the route
  middleware and the second is the handler.
- `Health check ping dropped`. The result is `Dropped`, which is neither a success nor an error.
- `Page view too old to store` for the stale page view, with an `ageMs` past the hour. The line
  carries a record id rather than a visitor id. Its handler throws `Failed()`, and the router
  recognises a thrown response, so this record has no error line at all.
- `Error processing Firehose record <recordId>` four times. Each one carries the failure under `error`.
- `Bot traffic refused` is the bot. `No route matched for record` is the `ping` event that nothing
  reads. `Data validation failed for record` appears twice, for the page view with no url and the sign
  up with the bad email.

The audit invocations show the other two paths:

- `Audit event archived` three times, for `alpha`, `alpha` and `beta`. That invocation holds no error
  line at all, which is what a clean pass looks like.
- One more `Error processing Firehose record` for the record that is not JSON. Its `error.message`
  reads `Data validation failed for record`. `error.issues` has an empty path, because the whole
  record failed rather than one field.

Note: a `ProcessingFailed` record is not retried. Firehose writes it to the error prefix and moves on.

## Streams and routes

| Delivery stream | Source | Routes |
| --- | --- | --- |
| `clickstream` | direct put | `dropHealthCheckPing`, `quarantineBotTraffic`, `redactVisitorEmail`, `recordPageView` |
| `audit-trail` | the `audit-events` Kinesis stream | `archiveAuditEvent` |

The Kinesis stream is provisioned with one shard. Provisioned costs less per hour than on-demand, and
one shard is more capacity than a run needs.

Both delivery streams call the worker on a 60 second buffer. That is what puts a group of records into
one invocation. Both write to S3 on a 60 second buffer as well, which is the shortest dynamic
partitioning allows.

Firehose rejects a lambda processor that sets a buffer interval without a buffer size, so both
processors set the size as well. A run holds a few hundred bytes, so the interval is what flushes it.

`audit-trail` has dynamic partitioning turned on, and its prefix is
`audit/tenant=!{partitionKeyFromLambda:tenantId}/`. Without it the partition keys a handler returns
have nowhere to go. It also forces a 64 MiB buffer size. No run comes close to filling that, so the 60
second interval is what flushes it.

## Iterating

```bash
pnpm -F @lambda-event-router/service-example-firehose diff   # review pending changeset
pnpm -F @lambda-event-router/service-example-firehose watch  # hotswap deploys
pnpm -F @lambda-event-router/service-example-firehose synth  # render template
```

## Tear down

```bash
aws s3 rm s3://<LandingBucketName> --recursive
pnpm -F @lambda-event-router/service-example-firehose destroy
```

CloudFormation will not delete a bucket with anything in it, so empty it first.

The stack owns everything else: both delivery streams, the Kinesis stream, the worker and the three
log groups. `destroy` removes all of them. Nothing is left behind.
