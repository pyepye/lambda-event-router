# Service example: Kafka

A deployable CDK app that exercises the `KafkaRouter` end to end. It models an order pipeline. One
Lambda consumes three topics on one Amazon MSK cluster, and the router does the per-record dispatch.

```
orders (3 partitions)
├── escalateUrgentOrder     (custom filter: a priority: urgent header)
└── processOrder            (eventSourceArn filter, created orders only)

payments (3 partitions)
├── refundPayment           (custom filter: a kind: refund header, always throws)
└── capturePayment          (bootstrapServer filter)

failed-records (3 partitions)
└── quarantineFailedRecord  (topic filter, reads Lambda's failure envelope)
```

## What it covers

One invoke of the producer sends a batch to each source topic. Together they hit every filter the
router has. They also cover each failure path it can take and the partition rules behind a retry.

| Feature | Where |
| --- | --- |
| `topic` filter | Every route carries one |
| `eventSourceArn` filter | `processOrder` pins the route to this cluster |
| `bootstrapServer` filter | `capturePayment` matches one broker address |
| `custom` filter | `escalateUrgentOrder` and `refundPayment` read the decoded headers |
| Zod schemas | `valueSchema` on every route |
| Router middleware | `logRecord` runs once per record |
| Route middleware | `withOrderContext` on `processOrder` |
| Batch item failures | `createKafkaRouter({ batchItemFailures: true })`, reported by all three mappings |
| No route matched | A cancelled order, which is neither urgent nor created |
| Handler failure | `refundPayment` throws after its middleware has run |
| Schema failures | An order with no total, and a payment that is not JSON |
| Partition isolation | A failure on `orders-1` leaves `orders-0` untouched |
| Blocked records | `order-1004` sits behind a failure on its partition and never runs |
| Retries exhausted | Lambda writes the record to `failed-records` after two retries |

CDK injects the cluster ARN and the broker list as env vars, and `src/environment.ts` reads them. The
`eventSourceArn` and `bootstrapServer` filters match against those values.

Handlers do their work by logging, so the CloudWatch logs are how you confirm routing.

Note: `event.records` is keyed by topic and partition together, such as `orders-1`, and each entry
holds only that partition's records. A re-delivered batch is thinner still. It carries `records`
alone, with no `eventSource`, `eventSourceArn` or `bootstrapServers`, so a filter on the cluster ARN
or a broker address has nothing to test on a retry and lets the record through.

## Prerequisites

- AWS account with credentials on the shell
- CDK bootstrap already run for the target account / region
- `AWS_REGION` set to the region the stack is deployed in
- Node 24 and pnpm installed

## Permissions

`deploy-policy.json` holds the minimum permissions needed to deploy this example and test it. Attach
it to the user or role you run the commands with.

CloudFormation work is done by the CDK bootstrap roles, so the policy only allows assuming those
roles. The rest covers invoking the producer, checking the cluster and reading the worker logs.
Actions are locked down, resources are not.

Note: the policy assumes the default bootstrap qualifier `hnb659fds`. Change the role and parameter
ARNs if your account uses a custom one.

## Deploy

From this directory:

```bash
pnpm -F @lambda-event-router/service-example-kafka run build
pnpm -F @lambda-event-router/service-example-kafka run deploy
```

CDK outputs include `ClusterArn`, `BootstrapServers`, `ProducerFunctionName` and
`WorkerLogGroupName`.

Creating the MSK cluster takes about 25 minutes and the deploy waits for it. Later deploys that only
change function code are quick.

The cluster and the provisioned pollers cost roughly $0.30 an hour while the stack is up. Tear it
down when you have finished.

To check the routing table without deploying, run
`pnpm -F @lambda-event-router/service-example-kafka run check`. It drives the built router with a
synthetic record per route and reports where each landed.

## Send sample messages

```bash
pnpm -F @lambda-event-router/service-example-kafka run trigger
```

MSK is reachable only from inside its VPC, so a Lambda in that VPC produces the messages. The command
invokes it and prints how many it sent.

That is one send per topic: five orders and five payments. Five records are meant to fail. One of
those fails only because it sits behind another.

The producer creates the three topics on its first run and checks that each has three partitions. A
second run needs no teardown, because it appends at higher offsets.

Each topic is sent as one batch on purpose. Partial batch failures and partition rules only show up
when several records from one partition reach a single invocation. Lambda decides how many records
that is, and there is no setting that forces it.

Note: a new event source mapping does not start reading for up to a minute. The mappings start at
`TRIM_HORIZON`, so nothing is lost. The first run after a deploy just takes longer to appear.

## Checking the logs

Wait about a minute, then save the worker logs to a file:

```bash
aws logs tail /aws/lambda/ler-example-kafka-worker --since 15m --format short > worker.log
```

The wait is for the failure topic. A failing record uses its retries first, and Lambda writes to
`failed-records` only once they are gone.

Widen the window with `--since`, which takes a single unit such as `30m`, `2h` or `1d`. The worker
logs in JSON, so `--format json` pretty prints the fields. Use `aws logs filter-log-events` when a
parser has to read the output.

There is one `Handling Kafka record` line per record that reaches a handler, and a retried record
gets another on every attempt.

Five records are handled:

- `Order context resolved` then `Order processed` for `order-1001`. Two lines in that order show the
  route middleware running inside the router middleware.
- `Urgent order escalated` for `order-1002`. It matches `processOrder`'s filters as well, but the
  urgent route is registered first and wins.
- `Payment captured` for `pay-5001`, `pay-5002` and `pay-5005`.
- `pay-5005` is produced with no key and no headers. Its lines carry no `key` field and an empty
  `headers` list.

Five records fail. Four of them log `Error processing Kafka record <topic>-<partition> offset <n>`,
and `error.message` tells them apart:

- `Value validation failed` appears twice, for `order-1003` with no total and `pay-5004` which is not
  JSON.
- `No route matched` is `order-1005`, the cancellation.
- `Refund gateway unavailable for payment pay-5003` comes from the handler. That record has a
  `Handling Kafka record` line, because the handler ran.
- `order-1004` has no line of its own. It is valid, but it sits behind `order-1003` on `orders-1`.
  The router reports it as failed without ever running it.

Note: no record that fails validation or matches no route has a `Handling Kafka record` line. The
router matches and validates before it runs any middleware.

The retries and the failure topic show up last:

- Each failing record logs its error three times, once plus the two retries the mapping allows.
  Count them by the partition and offset in the error line, never by the message text.
- `Failed record quarantined` appears four times, with a `condition` of `RetryAttemptsExhausted` and
  an `attempts` of 3. Lambda writes one record per reported group rather than one per record, so the
  five failures arrive as four, and the one for `orders-1` carries a `batchSize` of 2.
- The key on a quarantined record is Lambda's own, not the key the producer set.
- Invocations from `failed-records` report no failures at all, so they show what a clean pass looks
  like.

`orders-0` and `payments-0` carry nothing that fails. Their records run to completion in the same
invocation as the failures on the other partitions. That is what partition isolation looks like.

## Topics and routes

| Topic | Partitions | Routes |
| --- | --- | --- |
| `orders` | 3 | `escalateUrgentOrder`, `processOrder` |
| `payments` | 3 | `refundPayment`, `capturePayment` |
| `failed-records` | 3 | `quarantineFailedRecord` |

The cluster is two `kafka.t3.small` brokers with no authentication, reachable only inside its VPC.
Its configuration turns on topic auto-creation with three partitions, so nothing has to create the
topics before the mappings start.

All three mappings report batch item failures and retry a failed record twice. The two source
mappings then send it to `failed-records`. That mapping has no destination of its own, because Lambda
refuses one whose source and destination are the same topic.

The mappings use provisioned pollers. Retry limits and a failure destination exist only in that
mode. It also removes the NAT gateway or PrivateLink endpoints that on-demand pollers need. All three
mappings share one poller group, so they share one event poller unit.

## Iterating

```bash
pnpm -F @lambda-event-router/service-example-kafka run diff   # review pending changeset
pnpm -F @lambda-event-router/service-example-kafka run watch  # hotswap deploys
pnpm -F @lambda-event-router/service-example-kafka run synth  # render template
```

## Tear down

```bash
pnpm -F @lambda-event-router/service-example-kafka run destroy
```

That removes the whole stack, including the cluster, the VPC and all four functions. The log groups
go with it. Deleting the cluster takes about 15 minutes.
