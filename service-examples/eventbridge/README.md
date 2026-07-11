# Service example: EventBridge

A deployable CDK app that exercises the `EventBridgeRouter` end to end. It models an order
fulfilment bus. One rule forwards four event sources to a single Lambda, and the router decides
which handler each event reaches.

```
ler-example-events (custom bus, one rule, four sources)

ler.orders
├── flagHighValueOrder    (custom filter on the order amount)
├── processOrder          (source and detail type, route middleware)
├── archivePartnerOrder   (account filter, no local event matches it)
├── mirrorOrderUpdate     (region filter, no local event matches it)
└── updateOrder           (account and region filters)

ler.shipping
├── routeToLeedsWarehouse (resource filter, no detail schema)
└── dispatchShipment      (detail type list)

ler.payments
└── settlePaymentLedger   (always throws)

ler.legacy
└── nothing claims it
```

## What it covers

One `trigger` puts nine events on the bus. Between them they hit every filter the router has and all
three of its failure paths.

| Feature | Where |
| --- | --- |
| `source` filter | Every route names one |
| `detailType` filter | `processOrder` names one, `dispatchShipment` names a list |
| `account` filter | `archivePartnerOrder` waits for a partner account, `updateOrder` takes this one |
| `region` filter | `mirrorOrderUpdate` waits for `us-*`, `updateOrder` takes this one |
| `resource` filter | `routeToLeedsWarehouse` matches the warehouse ARN on the shipment |
| `custom` filter | `flagHighValueOrder` reads the order amount before any schema runs |
| Wildcard matching | `us-*` on a region, `warehouse/leeds-*` on a resource |
| Detail schemas | Seven routes carry a `detailSchema`, `routeToLeedsWarehouse` carries none |
| Router middleware | `logEvent` runs once per event |
| Route middleware | `withOrderContext` runs only on `processOrder` |
| Route order | Two pairs share a source and detail type, and the narrow route is registered first |
| No route matched | A `ler.legacy` event reaches the worker and no route claims it |
| Handler failure | `settlePaymentLedger` throws after its middleware has run |
| Schema failure | An order placed with no `amount` |
| Retries | A failed invocation runs three times |

CDK injects the account and region as env vars, and `src/config.ts` reads them. The `account` and
`region` filters match against those values.

EventBridge gives a Lambda target one event per invocation. There is no batching, so nine events make
nine invocations before any retry.

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
roles. The rest covers putting events on the bus and reading the worker logs. Actions are locked
down, resources are not.

Note: the policy assumes the default bootstrap qualifier `hnb659fds`. Change the role and parameter
ARNs if your account uses a custom one.

## Deploy

From this directory:

```bash
pnpm -F @lambda-event-router/service-example-eventbridge build
pnpm -F @lambda-event-router/service-example-eventbridge run deploy
```

The CDK outputs are `EventBusName` and `WorkerLogGroupName`.

The bus takes a fixed name, listed in `src/config.ts`. The stack and the trigger script read the same
constant. Deploying under a second stack name in one account therefore fails, because the bus name is
already taken.

## Publish sample events

```bash
pnpm -F @lambda-event-router/service-example-eventbridge trigger
```

The script takes no arguments.

It puts nine events on the bus in one `PutEvents` call. Three of them are meant to fail.

The `PutEvents` batch is a convenience for the publisher. EventBridge splits it and the worker never
sees more than one event at a time.

`PutEvents` keeps no state, so running the trigger twice in a row works with no teardown in between.

## Checking the logs

Save the worker logs to a file:

```bash
aws logs tail /aws/lambda/ler-example-eventbridge-worker --since 15m --format short > /tmp/ler-eventbridge.log
```

Wait about four minutes after the trigger before exporting. Most events arrive within seconds. The
third attempt at each failing event is the slowest thing to land.

Widen the window with `--since`, which takes a single unit such as `30m`, `2h` or `1d`. The worker
logs in JSON, so `--format json` pretty prints the fields.

Note: the log group is `/aws/lambda/<stackName>-worker`, so the name changes if you deploy with a
different `stackName`.

One trigger run puts 15 invocations in the log. Six are the events that succeed. The other nine are
the three failing events, three attempts each.

Nine invocations log `Handling EventBridge event` from the router middleware. That line carries the
event id, the source, the detail type, the account and the region.

Six invocations succeed:

- `High value order flagged for review` reports `AB-2041` at an `amount` of 249900. The custom filter
  took it before `processOrder` saw it.
- `Order context loaded` then `Order accepted for fulfilment` are order `AB-2042`. The first line is
  route middleware, which runs after `logEvent` and only on this route.
- `Order status updated` reports `AB-2042` as `packed`. `archivePartnerOrder` and `mirrorOrderUpdate`
  log nothing, because the event carries this account and this region.
- `Shipment sent to the Leeds depot` reports a `warehouse` ending `warehouse/leeds-01`.
- `Shipment sent to the carrier feed` appears twice. One is the Bristol shipment, which the resource
  filter turned down. The other is a `Shipment Delayed`, the second detail type in the route's list.

Nine invocations fail. Each leaves an `ERROR` record carrying `errorType`, `errorMessage` and a
`stackTrace`. There are three distinct messages, one per failing event, three attempts each:

- `Ledger service unavailable for payment PAY-77120` comes from the handler. Those three attempts
  have a `Handling EventBridge event` line, because the middleware ran before the handler threw.
- `Schema validation failed for event <id>` is order `AB-2043`, which carries no `amount`. Those three
  attempts have no `Handling EventBridge event` line. The router validates the detail before it runs
  any middleware.
- `No route matched for EventBridge event: ler.legacy / Batch Completed` comes from the router. Those
  three attempts have no `Handling EventBridge event` line either, for the same reason.

Note: the worker bundle is minified, so `errorType` on the schema failure is the minified class
name. The record carries the real one as `name`, alongside the Zod `issues`.

Note: an invocation whose handler threw still reports a `status` of `success` in its
`platform.report` line. Count the `ERROR` records instead.

Note: Lambda reuses the request id across retries of one event. Count attempts by `platform.start`
records rather than by distinct request ids.

## Bus and routes

| Source | Detail type | Filters beyond source and detail type | Route |
| --- | --- | --- | --- |
| `ler.orders` | `Order Placed` | `custom` on the amount | `flagHighValueOrder` |
| `ler.orders` | `Order Placed` | none | `processOrder` |
| `ler.orders` | `Order Updated` | `account` of the partner | `archivePartnerOrder` |
| `ler.orders` | `Order Updated` | `region` of `us-*` | `mirrorOrderUpdate` |
| `ler.orders` | `Order Updated` | `account` and `region` of this stack | `updateOrder` |
| `ler.shipping` | `Shipment Dispatched` | `resource` of a Leeds warehouse | `routeToLeedsWarehouse` |
| `ler.shipping` | `Shipment Dispatched`, `Shipment Delayed` | none | `dispatchShipment` |
| `ler.payments` | `Payment Captured` | none | `settlePaymentLedger` |
| `ler.legacy` | `Batch Completed` | none | none |

The rule forwards all four sources, so an unclaimed event still reaches the worker. That is what makes
the no route path observable.

EventBridge stamps the account and region from whoever published the event. A deployed run cannot
reach `archivePartnerOrder` or `mirrorOrderUpdate`. Every event it publishes carries this account and
this region. Reaching them needs a second account or region publishing onto the same bus. `check`
drives both in process instead.

The worker retries a failed invocation twice, which is the Lambda default for an asynchronous
invocation. There is no dead letter queue, so the third failure drops the event.

## Iterating

```bash
pnpm -F @lambda-event-router/service-example-eventbridge check    # drive the routes in process
pnpm -F @lambda-event-router/service-example-eventbridge diff     # review pending changeset
pnpm -F @lambda-event-router/service-example-eventbridge watch    # hotswap deploys
pnpm -F @lambda-event-router/service-example-eventbridge synth    # render template
```

`check` builds an event for every route, sends it through the router and reads the log the handler
wrote. It adds all three failure paths and the two routes a deployed run cannot reach. It needs no
AWS credentials.

## Tear down

```bash
pnpm -F @lambda-event-router/service-example-eventbridge destroy
```

That removes the bus, the rule, the worker, its log group and its role.

Wait for the failing events to finish retrying before you destroy. A retry that arrives after the
worker is deleted recreates the worker's log group. The stack is gone by then, so nothing removes it
again. Four minutes after the last trigger is enough.

Delete a log group left behind that way by hand:

```bash
aws logs delete-log-group --log-group-name /aws/lambda/ler-example-eventbridge-worker
```
