# Service example: Kinesis

A deployable CDK app that exercises the `KinesisRouter` end to end. It models an order and telemetry
pipeline. One Lambda consumes two Kinesis data streams, and the router does the per-record dispatch.

```
orders (1 shard)
├── flagHighValueOrder  (custom filter: the total is at or above 1000)
└── processOrder        (partitionKey customer-*)

telemetry (1 shard)
├── quarantineDevice    (partitionKey device-0042, always throws)
└── recordDeviceReading (eventSourceArn only)
```

A shard delivers its records in order, and a failing record holds that shard. Every record behind it
in the same batch is discarded with it. There is no on-failure destination. Lambda only writes those
to SQS or SNS, and this example stays on one service.

## What it covers

One `put:records` puts five groups of records on the two streams. Together they hit every filter the
router has and every failure path.

| Feature | Where |
| --- | --- |
| `eventSourceArn` filter | Every route matches one of the two streams by ARN |
| `partitionKey` filter | `processOrder` matches `customer-*`, `quarantineDevice` matches `device-0042` |
| `custom` filter | `flagHighValueOrder` reads the total before any schema runs |
| Zod schemas | `dataSchema` on all four routes |
| JSON numbers | `processOrder` gets `total` as a number, with nothing to coerce |
| Router middleware | `logRecord` runs once per record, on both streams |
| Route middleware | `withOrderContext` on `flagHighValueOrder`, typed to the route's data |
| Lambda middleware | `logBatchResponse` logs what the router hands back to Lambda |
| Batch item failures | `createKinesisRouter({ batchItemFailures: true })`, both streams report them |
| A batch with no failures | Two readings that both work, so the router returns nothing to report |
| No route matched | An order with a `web-checkout` partition key and a low total |
| Handler failure | `quarantineDevice` throws, after its middleware has run |
| Schema failures | An order with no total, and a reading that is not JSON |
| Retries | Every failing record is delivered a second time, then discarded |

Kinesis carries raw bytes. The router base64 decodes each record and then parses it as JSON, so a JSON
number arrives as a number. A payload that is not JSON is not rejected at that point. It reaches the
schema as a raw string.

Filters run before the schemas and read the parsed record. That is why `flagHighValueOrder` checks the
type of `total` before it compares it.

CDK injects both stream ARNs as env vars, and `src/config.ts` reads them. The `eventSourceArn` filters
match against those values.

Handlers do their work by logging. The router returns a batch response rather than anything a handler
produces, and `logBatchResponse` puts that in the log as well.

## Prerequisites

- AWS account with credentials on the shell
- CDK bootstrap already run for the target account / region
- Node 24 and pnpm installed

## Permissions

`deploy-policy.json` holds the minimum permissions needed to deploy this example and test it. Attach
it to the user or role you run the commands with.

CloudFormation work is done by the CDK bootstrap roles, so the policy only allows assuming those
roles. The rest covers putting the sample records and reading the worker logs. Actions are locked down,
resources are not.

Note: the policy assumes the default bootstrap qualifier `hnb659fds`. Change the role and parameter
ARNs if your account uses a custom one.

## Deploy

From this directory:

```bash
pnpm -F @lambda-event-router/service-example-kinesis build
pnpm -F @lambda-event-router/service-example-kinesis run deploy
```

CDK outputs include `OrdersStreamArn` and `TelemetryStreamArn`.

## Put sample records

Pass the two stream ARNs from the deploy outputs:

```bash
pnpm -F @lambda-event-router/service-example-kinesis run put:records \
  <OrdersStreamArn> <TelemetryStreamArn>
```

That is 11 records, six on the orders stream and five on telemetry. Four are meant to fail.

The records go in five groups. Four end in a failing record, and one has nothing wrong with it. A
failing record has to be alone in its batch, otherwise it discards the records behind it before they
are ever routed.

The script gets that separation by reading the worker's log. It puts a group, then polls for the last
record's sequence number until the line stops repeating. That means Lambda has run its last attempt and
moved past the batch.

Note: a fixed wait does not work here. An event source mapping takes up to a minute to start reading a
stream it has just been attached to. Until it does, every group piles into one batch.

The script takes about a minute on a warm stack, and up to two minutes on the first run after a deploy.
It exits once the log is complete, so there is nothing to wait for afterwards.

Records go one at a time. `PutRecords` does not promise to keep the order of its entries, and the order
is what puts each failing record at the end of its batch.

Every payload carries a fresh run id, and every handler logs it. That is how you pick one run's records
out of the log.

The script takes its region, both stream names and the worker's log group name from the ARNs, so it does
not need `AWS_REGION` set.

## Checking the logs

Save the worker logs to a file:

```bash
aws logs tail /aws/lambda/ler-example-kinesis-worker --since 15m --format short > worker.log
```

Widen the window with `--since`, which takes a single unit such as `30m`, `2h` or `1d`. The worker logs
in JSON, so `--format json` pretty prints the fields.

Note: the log group is `/aws/lambda/<stackName>-worker`, so the name changes if you deploy with a
different `stackName`.

One run produces 12 invocations across five batches. The batch with nothing wrong in it runs once.

There are 9 `Handling Kinesis record` lines. A record that matches no route, or fails its schema, never
gets one. The router matches and validates before it runs middleware.

Every failure logs the same line, `Error processing Kinesis record <eventID>`, and the detail sits under
`error`. The eventID reads `shardId-000000000000:<sequenceNumber>`.

The first four orders share a shard, so they arrive in one batch in the order they were put:

- `Order accepted for fulfilment` for `ord-1`. `totalType` reads `number`, because Kinesis carries the
  JSON as it was written.
- `Order escalated for review` then `High value order held for review` for `ord-2`. The first line is
  the route middleware and the second is the handler. Its total of 1850 is what sent it here rather
  than to `processOrder`.
- `Order accepted for fulfilment` for `ord-3`.
- An error for `ord-4` whose `error.message` starts `No route matched`. Its partition key is
  `web-checkout`, which `customer-*` does not cover, and its total sits below the high value line.

Telemetry is a second stream, so its records are batches of their own. The first two both work:

- `Device reading recorded` for `device-0117` and for `device-0204`.
- `Batch response returned` with no `response` field. The router returns `undefined` when it has no
  failure to report, and `JSON.stringify` drops the key. That batch runs once and is never retried.

The quarantined device follows, on its own:

- An error whose `error.message` is `Device device-0042 is quarantined`. It comes from the handler, so
  that record has a `Handling Kinesis record` line.

Two more batches follow, one per stream, each holding a schema failure:

- `Order accepted for fulfilment` for `ord-5`, then an `error.message` of
  `Data validation failed for record <eventID>` for `ord-6`, which has no `total`.
- `Device reading recorded` for `device-0117`, then the same `Data validation failed` message for the
  reading that is not JSON. The router hands `ReadingSchema` a raw string.

Both schema failures give the same `error.message`. `error.issues` is what names the field. `ord-6` reads
`path: ["total"]`, and the reading that is not JSON reads an empty path, because the whole record failed
rather than one field.

Every invocation ends with `Batch response returned`. Where there is a failure, the response names that
record and every record behind it in the batch. Each failing record is last in its group, so the
response names a single sequence number.

`retryAttempts` is 1, so each failing record gets a second delivery and is then discarded. That second
delivery carries the failing record alone, so nothing already handled runs again. `quarantineDevice` is
the exception. Its handler runs on both deliveries, so `device-0042` gets two `Handling Kinesis record`
lines.

Note: the same record can reach a handler more than once. Make handlers idempotent.

Note: nothing is logged when Lambda gives up on a batch. The record simply stops appearing.

## Streams and routes

| Stream | Shards | Routes |
| --- | --- | --- |
| `orders` | 1 | `flagHighValueOrder`, `processOrder` |
| `telemetry` | 1 | `quarantineDevice`, `recordDeviceReading` |

Both streams are provisioned with one shard and 24 hour retention. Provisioned costs less per hour than
on-demand. One shard keeps every record of a run in a single ordered lane.

Both event sources read from `TRIM_HORIZON`. Each takes up to ten records, with a two second batching
window.

## Iterating

```bash
pnpm -F @lambda-event-router/service-example-kinesis diff   # review pending changeset
pnpm -F @lambda-event-router/service-example-kinesis watch  # hotswap deploys
pnpm -F @lambda-event-router/service-example-kinesis synth  # render template
```

## Tear down

```bash
pnpm -F @lambda-event-router/service-example-kinesis destroy
```

The stack owns both streams and its log group. `destroy` removes the streams, the worker, the event
source mappings and the logs. The records the script put go with the streams. Nothing is left behind.
