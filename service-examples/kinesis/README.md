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

One `put:records` puts four groups of records on the two streams. Together they hit every filter the
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
| No route matched | An order with a `web-checkout` partition key and a low total |
| Handler failure | `quarantineDevice` throws, after its middleware has run |
| Schema failures | An order with no total, and a reading that is not JSON |
| Retries | Every failing batch is retried once, then discarded |

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

The records go in four groups, with one failing record at the end of each. Each failing record has to
be alone in its batch, otherwise it discards the records behind it before they are ever routed.

The script gets that separation by reading the worker's log. It puts a group, then polls for the
failing record's sequence number until the line stops repeating. That means Lambda has run its last
attempt and moved past the batch.

Note: a fixed wait does not work here. An event source mapping takes up to a minute to start reading a
stream it has just been attached to. Until it does, every group piles into one batch.

The script takes about 45 seconds on a warm stack, and up to two minutes on the first run after a
deploy. It exits once the log is complete, so there is nothing to wait for afterwards.

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

One run produces 12 invocations, three per failing batch.

There are 10 `Handling Kinesis record` lines. A record that matches no route, or fails its schema, never
gets one. The router matches and validates before it runs middleware.

Every failure logs the same message, `Error processing Kinesis record <eventID>`, and the detail sits in
`error.errorMessage`. The eventID reads `shardId-000000000000:<sequenceNumber>`.

The first four orders share a shard, so they arrive in one batch in the order they were put:

- `Order accepted for fulfilment` for `ord-1`. `totalType` reads `number`, because Kinesis carries the
  JSON as it was written.
- `Order escalated for review` then `High value order held for review` for `ord-2`. The first line is
  the route middleware and the second is the handler. Its total of 1850 is what sent it here rather
  than to `processOrder`.
- `Order accepted for fulfilment` for `ord-3`.
- An error for `ord-4` whose `errorMessage` starts `No route matched`. Its partition key is
  `web-checkout`, which `customer-*` does not cover, and its total sits below the high value line.

Telemetry is a second stream, so its first three records are a batch of their own:

- `Device reading recorded` twice, for `device-0117` and `device-0204`.
- An error for `device-0042` whose `errorMessage` is `Device device-0042 is quarantined`. It comes from
  the handler, so that record has a `Handling Kinesis record` line.

Two more batches follow, one per stream, each holding a schema failure:

- `Order accepted for fulfilment` for `ord-5`, then an `errorMessage` of
  `Data validation failed for record <eventID>` for `ord-6`, which has no `total`.
- `Device reading recorded` for `device-0117`, then the same `Data validation failed` message for the
  reading that is not JSON. The router hands `ReadingSchema` a raw string.

Both schema failures give the same `errorMessage`, so only the eventID tells them apart. The Zod issues
are attached to the error as `cause` and never reach the log.

Every invocation ends with `Batch response returned`. The response names the failing record and every
record behind it in the batch. Each failing record is last in its group, so the response names a single
sequence number.

Each failing batch runs three times under two request ids. The first delivery gets one request id, and
the retry gets the other and arrives twice. The retry carries the failing record alone, so nothing
already handled runs again. `quarantineDevice` is the exception. Its handler runs on every delivery, so
`device-0042` gets three `Handling Kinesis record` lines.

Note: an event source mapping delivers at least once. A handler has to cope with the same record
arriving twice under one request id.

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
