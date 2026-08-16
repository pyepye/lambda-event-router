# Service example: Config

A deployable CDK app that exercises the `ConfigRouter` and the `ConfigScheduledRouter` end to end.
It models a platform team's compliance checks for Lambda functions. One Lambda backs ten custom Config
rules, and the routers decide which handler each evaluation reaches.

The routes are in `src/configRouter.ts` and `src/configScheduledRouter.ts`, and the handlers are in `src/handlers/`.

The steps to run it are in [Prerequisites](#prerequisites), [Permissions](#permissions)
and [Deploy](#deploy).

```
Change-triggered rules (ConfigRouter), evaluating checkout-api and report-builder
├── approved-runtime       checkRuntime             (resourceType and configurationItemStatus filters)
├── memory-limit           grantMemoryExemption     (resourceId filter, ranks first)
│                          checkMemoryLimit         (rule name only)
├── service-catalogue      registerInCatalogue      (async custom filter, configuration schema)
├── timeout-limit          checkTimeoutLimit        (parameters never pass their schema)
├── on-call-rota           checkOnCallRota          (route middleware, always throws)
└── confidential-tracing   no route

Periodic rules (ConfigScheduledRouter), evaluating the account
├── lambda-inventory       recordFunctionInventory  (accountId filter, route middleware)
├── idle-function-sweep    sweepIdleFunctions       (async custom filter, parameters never pass)
├── concurrency-headroom   checkConcurrencyHeadroom (always throws)
└── cost-report            no route
```

## What it covers

One `evaluate` asks Config to run all ten rules. Together they hit every filter both routers have,
both schemas and every failure.

| Feature | Where |
| --- | --- |
| `configRuleName` filter | Every route |
| `resourceType` filter | `checkRuntime` takes `AWS::Lambda::Function` only |
| `configurationItemStatus` filter | `checkRuntime` takes `OK` and `ResourceDiscovered`, so a deleted function never reaches it |
| `resourceId` filter | `grantMemoryExemption` takes `report-builder` only |
| `custom` filter on changes | `registerInCatalogue` asks the service catalogue whether a function is decommissioned |
| `accountId` filter | `recordFunctionInventory` takes this account only |
| `custom` filter on schedules | `sweepIdleFunctions` reads a feature flag |
| Route ranking | `grantMemoryExemption` is registered after `checkMemoryLimit`, but its narrower filters rank it first |
| `ruleParametersSchema` | Turns `allowedRuntimes` into a list and `maxMemoryMb` and `maxFunctions` into numbers |
| `configurationSchema` | Reads `runtime`, `memorySize` and `description` from the configuration item |
| Router middleware | `logEvaluation` and `logScheduledRun`, one per router |
| Route middleware | `withOwnerContext` on `checkOnCallRota`, `withAccountContext` on `recordFunctionInventory` |
| Evaluation results | Every handler that succeeds calls `PutEvaluations`, so Config shows its result |
| No route matched | `confidential-tracing` and `cost-report` have no route |
| Schema failures | `report-builder` has no description, and two rules have parameters that will not coerce |
| Handler failure | `checkOnCallRota` and `checkConcurrencyHeadroom` throw after their middleware has run |
| Async retries | Config invokes the worker asynchronously, so Lambda retries each failure twice |

CDK injects the stack name and the account ID as env vars, and `src/environment.ts` reads them. The
rule name filters and the `accountId` filter are built from those values.

A deployed run cannot reach the oversized path. Config sends a summary in place of an item over
256 KB. A Lambda function's item is a few KB. `check` drives it in process
instead, along with a deleted resource.

Handlers log what they did, and report it to Config. The CloudWatch logs are how you confirm routing.

## Prerequisites

- AWS account with credentials on the shell
- CDK bootstrap already run for the target account / region
- `AWS_REGION` set to the region the stack is deployed in
- No AWS Config recorder in that region, because an account holds one per region
- Node 24 and pnpm installed

## Permissions

`deploy-policy.json` holds the minimum permissions needed to deploy this example and test it. Attach
it to the user or role you run the commands with.

CloudFormation work is done by the CDK bootstrap roles, so the policy only allows assuming those
roles. The rest covers checking what Config has recorded and starting an evaluation. It also covers
reading Config's results, emptying the delivery bucket and reading the worker logs. Actions are locked down, resources are not.

Note: the policy assumes the default bootstrap qualifier `hnb659fds`. Change the role and parameter
ARNs if your account uses a custom one.

## Deploy

From this directory:

```bash
pnpm -F @lambda-event-router/service-example-config... install
pnpm -F @lambda-event-router/service-example-config... run build
pnpm -F @lambda-event-router/service-example-config run deploy
```

CDK outputs include `DeliveryBucketName` and `WorkerLogGroupName`.

To check the routing table without deploying, run
`pnpm -F @lambda-event-router/service-example-config run check`. It drives the built routers with a
synthetic event for each route and reports where each one landed.

Note: deploying runs every rule at least once. Config evaluates each rule within seconds of creating
it. Wait 5 minutes after the deploy before you evaluate, so those retries are over.

## Run a sample evaluation

```bash
pnpm -F @lambda-event-router/service-example-config run evaluate
```

The script first waits until Config has recorded both deployed functions. On a redeploy that reuses
their names, this can take 20 minutes. Config may first record the functions from the last deploy.

It then asks Config to evaluate all ten rules, and waits until Config has invoked the worker for each
rule. A rule Config has just evaluated for a newly recorded function can skip the request. The
script asks again for any rule that has not run after 90 seconds. Then it prints a log start time for
the export below.

A change-triggered rule sends one event per function in its scope. A periodic rule sends one event
for the account. That makes 13 events.

Running the script twice in a row works. Config refuses a new evaluation while the last one is
running or within a minute of it. The script retries until Config accepts. The second run's log
window then holds the first run's late retries too.

Config sends one event per invocation. There is no batch, so there is no ordering or partial-failure
behaviour to show.

## Checking the logs

Wait 5 minutes after `evaluate` finishes. Lambda retries a failed evaluation after about a minute,
then again about two minutes later.

Read Config's view of each rule, then save the worker logs to a file. Use the start time `evaluate`
printed:

```bash
aws configservice describe-compliance-by-config-rule --output table \
  --query "ComplianceByConfigRules[?starts_with(ConfigRuleName, 'ler-example-config-')]"
aws logs filter-log-events --log-group-name /aws/lambda/ler-example-config-worker \
  --start-time <logStartTime> --output json > ~/ler-example-config-worker.json
```

To read the log rather than parse it, use
`aws logs tail /aws/lambda/ler-example-config-worker --since 10m --format short`.

Note: the log group is `/aws/lambda/<stackName>-worker`, so the name changes if you deploy with a
different `stackName`.

Config shows a result only for rules whose handler called `PutEvaluations`:

- `approved-runtime` is `NON_COMPLIANT`, because `report-builder` runs `python3.12`.
- `memory-limit` is `COMPLIANT`. `report-builder` is `NOT_APPLICABLE`, which does not count against it.
- `service-catalogue` is `COMPLIANT`, from `checkout-api` alone.
- `lambda-inventory` is `COMPLIANT`.
- The other six are `INSUFFICIENT_DATA`, because their handler never reported.

The log holds at least 13 events. Six succeed on the first attempt. Seven fail, and each one runs
three times.

Config can send the four failing change-triggered events again, about a minute later. Each resend is
a new event with its own request id, and it runs three times too.

Six `Evaluation reported` lines carry each result as `complianceType` and `annotation`:

- `checkRuntime` reports `checkout-api` as `COMPLIANT` with `nodejs22.x is approved`.
- `checkRuntime` reports `report-builder` as `NON_COMPLIANT` with
  `python3.12 is not one of nodejs22.x, python3.13`. The schema turned the parameter string into a list.
- `checkMemoryLimit` reports `checkout-api` as `COMPLIANT` with `256 MB is within the 1024 MB limit`.
  The schema turned `maxMemoryMb` from a string into a number.
- `grantMemoryExemption` reports `report-builder` as `NOT_APPLICABLE` with
  `Exempt from the memory limit until 2027-03-31`. Both memory routes match this event, and the
  narrower one wins.
- `registerInCatalogue` reports `checkout-api` as `COMPLIANT`, after a
  `Registered in service catalogue` line. The async custom filter let it through.
- `recordFunctionInventory` reports `AWS::::Account` as `<n> of at most 200 Lambda functions recorded`.
  An `Account context resolved` line comes first, with `maxFunctions` as the number 200.

The inventory count is every Lambda function the recorder has found in the region, so it depends on
the account.

The router middleware logs `Handling configuration change` or `Handling scheduled evaluation` on every
attempt that passes routing and validation. That is at least 8 and 4 lines, and a resend adds three
more of the first. Each carries the raw `event` as Config delivered it, and the configuration item's
`configurationItemStatus`. That is `ResourceDiscovered` for a function Config has recorded once, and
`OK` after a later change.

There are at least 21 `ERROR` records, which are seven messages three times each. A resend adds 12.
Each record carries `errorMessage` and a `stackTrace`:

- `On-call directory unavailable for team payments` comes from the handler. Each attempt has a
  `Handling configuration change` line, then `Owner resolved` with `owner` `payments`.
- `Concurrency metrics unavailable for account <id>` comes from the handler. Each attempt has a
  `Handling scheduled evaluation` line.
- `Schema validation failed for configuration` is `report-builder` on `service-catalogue`. Its
  `issues` name `description`.
- `Schema validation failed for ruleParameters` appears for two rules. On `timeout-limit` the
  `issues` name `maxTimeoutSeconds`, and on `idle-function-sweep` they name `maxIdleDays`.
- `No route matched for config rule ler-example-config-confidential-tracing` comes from the router.
- `No route matched for scheduled config rule ler-example-config-cost-report` comes from the router.

The schema and routing failures have no middleware line. The routers match a route and validate
before they run any middleware.

Read `name` rather than `errorType` on the validation records. The bundle is minified, so `errorType`
holds a mangled class name for `SchemaValidationError`.

Note: an invocation whose handler threw still reports a `status` of `success` in its
`platform.report` line. Count the `ERROR` records instead.

Note: Lambda reuses the request id across retries of one event. Count attempts by `platform.start`
records rather than by distinct request ids.

## Rules and routes

| Rule | Runs | Scope | Route |
| --- | --- | --- | --- |
| `approved-runtime` | on change | `compliance-scope` tag | `checkRuntime` |
| `memory-limit` | on change | `compliance-scope` tag | `grantMemoryExemption` for `report-builder`, else `checkMemoryLimit` |
| `service-catalogue` | on change | `compliance-scope` tag | `registerInCatalogue` |
| `timeout-limit` | on change | `owner` tag | `checkTimeoutLimit` |
| `on-call-rota` | on change | `owner` tag | `checkOnCallRota` |
| `confidential-tracing` | on change | `data-classification` tag | none |
| `lambda-inventory` | daily | account | `recordFunctionInventory` |
| `idle-function-sweep` | daily | account | `sweepIdleFunctions` |
| `concurrency-headroom` | daily | account | `checkConcurrencyHeadroom` |
| `cost-report` | daily | account | none |

Each rule's full name starts with the stack name, such as `ler-example-config-approved-runtime`.

| Function | Runtime | Memory | Description | Tags |
| --- | --- | --- | --- | --- |
| `checkout-api` | `nodejs22.x` | 256 MB | set | `compliance-scope`, `owner` |
| `report-builder` | `python3.12` | 2048 MB | none | `compliance-scope`, `data-classification` |

Neither function is ever invoked. The recorder records every Lambda function in the region. Only
these two carry the tags the rules are scoped to.

A Config rule needs a recorder, and a recorder needs a delivery channel with an S3 bucket. The bucket
is the only second service, and nothing reads it.

The worker retries a failed evaluation twice, which is the Lambda default for an asynchronous
invocation. There is no dead letter queue, so the third failure drops the event. That resource then
has no result for the rule.

## Iterating

```bash
pnpm -F @lambda-event-router/service-example-config run check  # drive the routes in process
pnpm -F @lambda-event-router/service-example-config run diff   # review pending changeset
pnpm -F @lambda-event-router/service-example-config run watch  # hotswap deploys
pnpm -F @lambda-event-router/service-example-config run synth  # render template
```

## Tear down

```bash
pnpm -F @lambda-event-router/service-example-config run destroy
```

The script empties the delivery bucket, then runs `cdk destroy`. That removes every Config resource,
the bucket, all three functions and both log groups.

Config keeps the configuration items it recorded after the recorder has gone. They are not a resource,
and nothing else is left behind.

Note: the bucket script reads the stack name from `STACK_NAME`. Set it if you deployed with a
different `stackName`.
