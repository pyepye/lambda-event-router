# Service example: CloudWatch Logs

A deployable CDK app that exercises the `CloudWatchLogsRouter` end to end. It models a log triage
service. Five log groups are subscribed to one Lambda, and the router decides what happens to each
delivery.

The steps to run it are in [Prerequisites](#prerequisites), [Permissions](#permissions)
and [Deploy](#deploy).

```
/ler-example/checkout-api
├── checkout-errors  → escalateCheckoutFailure  (subscriptionFilter filter)
└── checkout-traffic → indexCheckoutTraffic     (logGroup filter, registered with dataMessage)

/ler-example/payments-worker and /ler-example/payments-refunds
├── quarantineDeclinedPayment  (logGroup wildcard plus a custom filter)
└── archivePaymentTraffic      (logGroup wildcard)

/ler-example/audit-trail
└── forwardAuditToSiem         (logGroup and messageType, always throws)

/ler-example/legacy-batch
└── nothing claims it
```

## What it covers

One `trigger` writes log lines to all five groups. Six subscription filters turn those into six
deliveries. Between them they hit every filter the router has and both of its failure paths.

| Feature | Where |
| --- | --- |
| `logGroup` filter | `indexCheckoutTraffic` matches `/ler-example/checkout-api` |
| `logGroup` wildcard | `quarantineDeclinedPayment` and `archivePaymentTraffic` share `/ler-example/payments-*` |
| `subscriptionFilter` filter | `escalateCheckoutFailure` matches the filter named `checkout-errors` |
| `messageType` filter | `indexCheckoutTraffic` is registered with `dataMessage`, and `forwardAuditToSiem` names both types |
| `custom` filter | `quarantineDeclinedPayment` reads the log events for a declined payment |
| Router middleware | `logDelivery` runs once per delivery |
| Route middleware | `withIncidentContext` runs only on the checkout error route |
| Route order | An error delivery matches two routes, and the first registered one takes it |
| Several events per delivery | The checkout group sends four log lines to one invocation |
| No route matched | `/ler-example/legacy-batch` is subscribed and no route claims it |
| Handler failure | `forwardAuditToSiem` throws after its middleware has run |
| Retries | A failed delivery runs three times |

The router has no schemas, so a delivery either matches a route or it does not.

Handlers do their work by logging, so the worker's own log group is how you confirm routing.

## Prerequisites

- AWS account with credentials on the shell
- `AWS_REGION` set to the region the stack is deployed in
- CDK bootstrap already run for the target account / region
- Node 24 and pnpm installed

## Permissions

`deploy-policy.json` holds the minimum permissions needed to deploy this example and test it. Attach
it to the user or role you run the commands with.

CloudFormation work is done by the CDK bootstrap roles, so the policy only allows assuming those
roles. The rest covers writing log lines to the subscribed groups and reading the worker logs.
Actions are locked down, resources are not.

Note: the policy assumes the default bootstrap qualifier `hnb659fds`. Change the role and parameter
ARNs if your account uses a custom one.

## Deploy

From this directory:

```bash
pnpm -F @lambda-event-router/service-example-cloudwatch... install
pnpm -F @lambda-event-router/service-example-cloudwatch... build
pnpm -F @lambda-event-router/service-example-cloudwatch run deploy
```

The CDK output is `WorkerLogGroupName`.

The five subscribed log groups take fixed names, listed in `src/config.ts`. The route filters and the
trigger script read the same constants. Deploying under a second stack name in one account therefore
fails, because the log group names are already taken.

## Write sample log events

```bash
pnpm -F @lambda-event-router/service-example-cloudwatch trigger
```

The script takes no arguments.

It writes 12 lines across the five groups. One line is an `ERROR` and one is a declined payment. The
rest are ordinary traffic. Six deliveries reach the worker, and two of them are meant to fail.

Each group gets its lines in a single `PutLogEvents` call, so the subscription delivers them to one
invocation. Several log events in one delivery is the normal shape here. CloudWatch Logs sends one
delivery per invocation and never puts two deliveries together.

Every run writes to a new log stream named after the clock, so running the trigger twice in a row
works with no teardown in between.

## Checking the logs

Save the worker logs to a file:

```bash
aws logs tail /aws/lambda/ler-example-cloudwatch-worker --since 15m --format short > /tmp/ler-cloudwatch.log
```

Wait about four minutes after the trigger before exporting. Deliveries arrive within seconds. The
third attempt at each failing delivery is the slowest thing to land.

Widen the window with `--since`, which takes a single unit such as `30m`, `2h` or `1d`. The worker
logs in JSON, so `--format json` pretty prints the fields.

Note: the log group is `/aws/lambda/<stackName>-worker`, so the name changes if you deploy with a
different `stackName`.

One trigger run puts 10 invocations in the log. Four are the deliveries that succeed. The other six
are the two failing deliveries, three attempts each.

Seven invocations log `Handling log delivery` from the router middleware. That line carries the log
group, the log stream, the subscription filter names, the message type and the event count.

Four invocations succeed:

- `Incident opened` then `Checkout failure escalated` are the `checkout-errors` delivery. The first
  line is route middleware, which runs after `logDelivery` and only on this route. `errorCount` is 1,
  because the filter pattern only takes the `ERROR` line.
- `Checkout traffic indexed` reports an `indexedCount` of 4. That is the same four lines again, this
  time through `checkout-traffic`.
- `Declined payment quarantined` reports a `declinedCount` of 1 and a `heldCount` of 3. The custom
  filter found the declined line and held the whole delivery.
- `Payment traffic archived` reports an `archivedCount` of 2. Both payments routes share one log
  group wildcard, so reaching this one means the custom filter turned the refunds delivery down.

Six invocations fail. Each leaves an `ERROR` record carrying `errorType`, `errorMessage` and a
`stackTrace`. There are two distinct messages, one per failing delivery, three attempts each:

- `SIEM endpoint unreachable for /ler-example/audit-trail` comes from the handler. Those three
  attempts have a `Handling log delivery` line, because the middleware ran before the handler threw.
- `No route matched for log group /ler-example/legacy-batch` comes from the router. Those three
  attempts have no `Handling log delivery` line. The router matches a route before it runs any
  middleware.

Note: an invocation whose handler threw still reports a `status` of `success` in its
`platform.report` line. Count the `ERROR` records instead.

Note: Lambda reuses the request id across retries of one delivery. Count attempts by `platform.start`
records rather than by distinct request ids.

## Log groups and routes

| Log group | Subscription filter | Pattern | Route |
| --- | --- | --- | --- |
| `/ler-example/checkout-api` | `checkout-errors` | `?"ERROR" ?"FATAL"` | `escalateCheckoutFailure` |
| `/ler-example/checkout-api` | `checkout-traffic` | everything | `indexCheckoutTraffic` |
| `/ler-example/payments-worker` | `payments-traffic` | everything | `quarantineDeclinedPayment` |
| `/ler-example/payments-refunds` | `refunds-traffic` | everything | `archivePaymentTraffic` |
| `/ler-example/audit-trail` | `audit-traffic` | everything | `forwardAuditToSiem` |
| `/ler-example/legacy-batch` | `legacy-traffic` | everything | none |

Two filters is the CloudWatch Logs maximum for one log group. The checkout group carries a pair, so a
single `ERROR` line arrives twice under two different filter names.

Every log group in the stack keeps one day of logs.

## Iterating

```bash
pnpm -F @lambda-event-router/service-example-cloudwatch check    # drive the routes in process
pnpm -F @lambda-event-router/service-example-cloudwatch diff     # review pending changeset
pnpm -F @lambda-event-router/service-example-cloudwatch watch    # hotswap deploys
pnpm -F @lambda-event-router/service-example-cloudwatch synth    # render template
```

`check` gzips a delivery for every route, sends it through the router and reads the log the handler
wrote. It adds a control message and both failure paths. It needs no AWS credentials.

## Tear down

```bash
pnpm -F @lambda-event-router/service-example-cloudwatch destroy
```

That removes the five subscribed log groups and their filters. It also removes the worker, its log
group and its role. Log streams written by the trigger go with their log group.
