# Service example: Step Functions

A deployable CDK app that exercises the `StepFunctionsRouter` end to end. It models an order
fulfilment workflow. One state machine invokes one Lambda across ten parallel branches, and the
router decides which handler each payload reaches.

The steps to run it are in [Prerequisites](#prerequisites), [Permissions](#permissions)
and [Deploy](#deploy).

```
OrderFulfilment (standard workflow)
├── reserveStock         (custom filter: task === 'reserve-stock', refuses callbacks)
├── chargePayment        (async custom filter: task === 'charge-payment')
├── approveFraudReview   (taskToken filter plus custom, replies with SendTaskSuccess)
├── releaseStockHold     (custom filter, always throws)
└── failUnknownCallback  (taskToken filter only, replies with SendTaskFailure)
```

## What it covers

One `trigger` starts one execution. Its `Parallel` state runs ten branches. Together they hit every
filter the router has, both request shapes and every failure it can produce.

| Feature | Where |
| --- | --- |
| `custom` filter | `reserveStock` and `releaseStockHold` match on the `task` field |
| Async `custom` filter | `chargePayment` returns a promise, which the router awaits |
| `taskToken` filter | The four callback branches match on a `TaskToken` in the payload |
| `taskToken` false | `reserveStock` refuses `AwaitStockReservation`, which carries a `TaskToken` |
| Route order | `approveFraudReview` declines `AwaitManualRelease`, so `failUnknownCallback` takes it |
| Standard schemas | `eventSchema` on four routes, and none on `failUnknownCallback` |
| TaskToken stripping | `approveFraudReview` logs that `input` has no `TaskToken` and `event` still does |
| Router middleware | `logTask` runs once per matched route |
| Route middleware | `withOrderContext` on a regular route, `withApprovalContext` on a callback route |
| Task results | Three branches return a value, which becomes the branch result |
| No route matched | `ReconcileLedger` carries a task name no filter claims, so the router declines it |
| Handler failure | `ReleaseStockHold` throws, and the state retries it twice |
| Schema failures | A worded order total, and a fraud review with no risk score |
| Declined event | `ForwardScheduledEvent` sends an EventBridge payload, which the router refuses |

Every branch catches its own failure and writes the result into the execution output. That output is
the whole run in one JSON array. The worker log is the second view of it.

`src/config.ts` holds the task names. The route filters and the state machine payloads both read
them, so neither can drift from the other.

## Prerequisites

- AWS account with credentials on the shell
- CDK bootstrap already run for the target account / region
- `AWS_REGION` set to the region the stack is deployed in
- Node 24 and pnpm installed

## Permissions

`deploy-policy.json` holds the minimum permissions needed to deploy this example and test it. Attach
it to the user or role you run the commands with.

CloudFormation work is done by the CDK bootstrap roles, so the policy only allows assuming those
roles. The rest covers starting an execution, reading its result and reading the worker logs.
Actions are locked down, resources are not.

Note: the policy assumes the default bootstrap qualifier `hnb659fds`. Change the role and parameter
ARNs if your account uses a custom one.

## Deploy

From this directory:

```bash
pnpm -F @lambda-event-router/service-example-stepfunctions... install
pnpm -F @lambda-event-router/service-example-stepfunctions... build
pnpm -F @lambda-event-router/service-example-stepfunctions run deploy
```

CDK outputs include `StateMachineArn` and `WorkerLogGroupName`.

To check the routing table without deploying, run
`pnpm -F @lambda-event-router/service-example-stepfunctions check`. It drives the built router with a
synthetic payload for each branch and reports where each one landed.

## Start a sample execution

```bash
pnpm -F @lambda-event-router/service-example-stepfunctions trigger
```

The script finds the state machine by name and starts an execution with `{"orderId":"AB-1029"}`. It
then waits for the execution to finish and prints the output. Each run uses a new execution name, so
a second run needs no teardown after the first.

The execution takes a few seconds. Three of the ten branches produce a result and seven produce an
error. The execution still ends as `SUCCEEDED`, because each branch catches its own failure.

Step Functions delivers one payload per invocation. There is no batch delivery, so no ordering or
partial-failure behaviour to show.

## Checking the logs

The execution output is the first thing to read. The trigger prints it, and each entry carries the
`step` that produced it. A failing entry also carries an `error` object with `Error` and `Cause`:

- `reserveStock` returns `RES-AB-1029` for `SKU-8891` from warehouse `LDN-1`. That proves the custom
  filter, the schema, the route middleware and the result in one entry.
- `chargePayment` returns `PAY-AB-1029` and `capturedPence` 4250. The filter that matched it is
  async, so the router awaited a promise to get there.
- `approveFraudReview` returns `decision` `approved` with `riskScore` 12. That value comes from
  `SendTaskSuccess` rather than from the Lambda response, so the callback completed.
- `failUnknownCallback` fails with `UnknownCallbackTask` and a `Cause` of
  `No callback route handles manual-release`. The payload carries a `TaskToken` and a task name
  `approveFraudReview` does not claim. It reaches the fallback route, which is route order at work.
- `awaitStockReservation` fails the same way, with a `Cause` of
  `No callback route handles reserve-stock`. `reserveStock` claims that task name but sets
  `taskToken` to `false`, so a callback payload goes past it.
- `releaseStockHold` fails with a `Cause` holding `Warehouse API unavailable for RES-AB-1029`.
- `reconcileLedger` fails with a `Cause` holding `No router found for event`. No route claims the task
  name, so the router declines the payload and `LambdaRouter` runs out of routers to try.
- `chargeUnpricedOrder` fails with `SchemaValidationError` and `Event validation failed`, because
  `amountPence` arrived as a sentence.
- `awaitUnscoredReview` fails with `SchemaValidationError` the same way. The payload carries a
  `TaskToken`, so the router matched the callback route. It then rejected the rest of the payload.
- `forwardScheduledEvent` fails with a `Cause` holding `No router found for event`. The payload looks
  like an EventBridge event, so `canHandleEvent` refuses it before any route is considered.

Save the worker logs to a file:

```bash
aws logs tail /aws/lambda/ler-example-stepfunctions-worker --since 10m --format short > worker.log
```

Widen the window with `--since`, which takes a single unit such as `30m`, `2h` or `1d`. The worker
logs in JSON, so a handler field such as `orderId` sits under `message` rather than at the top level.

Use `aws logs filter-log-events` when you want to parse the file. `aws logs tail --format json`
writes a header line before each event, so the file will not parse.

Note: the log group is `/aws/lambda/<stackName>-worker`, so the name changes if you deploy with a
different `stackName`.

The log holds twelve invocations: one per branch, plus two retries of `ReleaseStockHold`.

Eight of them log `Handling Step Functions task`, which is the router middleware. The other four
never reach it. Two failed their schema, one matched no route, and one was refused by
`canHandleEvent`.

The router runs middleware only after a route has matched and its schema has passed. That is why a
rejected payload has no `Handling Step Functions task` line.

The routes that ran log what they did:

- `Order context resolved` then `Stock reserved`, which is route middleware before its handler.
- `Payment captured` for the order total.
- `Fraud review context resolved` then `Fraud review decided`. The second line carries
  `taskTokenInInput` `false` and `taskTokenInEvent` `true`. The router removes `TaskToken` from
  `input` and leaves `event` alone.
- `Unknown callback task refused` at WARN, twice, once per unclaimed callback.

Seven `ERROR` records carry the failures. Each one has `errorMessage` and a `stackTrace`. Three come
from `releaseStockHold` across its three attempts. The other four are one each from the two schema
failures, the unmatched task and the refused event.

Read `name` rather than `errorType` on those records. The bundle is minified, so `errorType` holds a
two-letter class name for `NoRouteMatchedError` and `SchemaValidationError`. The `Cause` in the
execution output is unaffected and carries the real name. A plain `Error` has no `name`, and its
`errorType` is `Error`.

A `SchemaValidationError` record also carries `issues`, which names the field that failed. The
`awaitUnscoredReview` record points at `riskScore`.

`failUnknownCallback` produces no `ERROR` record. It reports the failure through `SendTaskFailure`
and returns normally.

Note: an invocation whose handler threw still reports `status` `success` in its `platform.report`
line, and that record carries no error field. Count the `ERROR` records instead.

## State machines and routes

| Branch | Payload | Route |
| --- | --- | --- |
| `ReserveStock` | `reserve-stock` | `reserveStock` |
| `ChargePayment` | `charge-payment` | `chargePayment` |
| `AwaitFraudReview` | `fraud-review` with a token | `approveFraudReview` |
| `AwaitManualRelease` | `manual-release` with a token | `failUnknownCallback` |
| `AwaitStockReservation` | `reserve-stock` with a token | `failUnknownCallback` |
| `ReleaseStockHold` | `release-stock-hold` | `releaseStockHold` |
| `ReconcileLedger` | `reconcile-ledger` | none |
| `ChargeUnpricedOrder` | `charge-payment` with a worded total | `chargePayment` |
| `AwaitUnscoredReview` | `fraud-review` with a token, no risk score | `approveFraudReview` |
| `ForwardScheduledEvent` | an EventBridge event | none |

The four callback branches time out after 60 seconds. Nothing in the example reaches that. The
timeout is there so a branch that never calls back ends the execution rather than stalling it.

## Iterating

```bash
pnpm -F @lambda-event-router/service-example-stepfunctions diff   # review pending changeset
pnpm -F @lambda-event-router/service-example-stepfunctions watch  # hotswap deploys
pnpm -F @lambda-event-router/service-example-stepfunctions synth  # render template
```

## Tear down

```bash
pnpm -F @lambda-event-router/service-example-stepfunctions destroy
```

That removes the state machine, the worker and its log group, which is everything the stack creates.
Execution history goes with the state machine.
