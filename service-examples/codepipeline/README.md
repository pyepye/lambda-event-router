# Service example: CodePipeline

A deployable CDK app that exercises the `CodePipelineRouter` end to end. It models a release
pipeline. Two Lambda functions share one router bundle, and the router decides which handler each
pipeline job reaches.

The steps to run it are in [Prerequisites](#prerequisites), [Permissions](#permissions)
and [Deploy](#deploy).

```
ler-example-codepipeline-release
├── verifyReleaseBundle   (deployer, has input artifacts, writes an output artifact)
├── startCanaryDeployment (deployer, no continuation token, async custom filter)
├── awaitCanaryHealth     (deployer, registered with continuation(), two rounds)
├── publishReleaseNotes   (notifier, no schema)
└── rollbackRelease       (deployer, no input artifacts, always throws)
```

## What it covers

One `release` starts one execution. Its six Lambda actions hit every filter the router has, every
response shape and all three of its failures.

| Feature | Where |
| --- | --- |
| `functionName` filter | `publishReleaseNotes` takes the notifier's jobs, the other four take the deployer's |
| `hasInputArtifacts` filter | `verifyReleaseBundle` needs the source artifact, `rollbackRelease` refuses one |
| `hasContinuationToken` filter | `startCanaryDeployment` takes the first invocation of the canary action only |
| `custom` filter | `verifyReleaseBundle` reads `step` out of the raw UserParameters |
| Async `custom` filter | Both canary routes return a promise, which the router awaits |
| `continuation()` helper | `awaitCanaryHealth` is registered with it, which adds `hasContinuationToken: true` |
| Route order | `rollbackRelease` claims any deployer job with no artifact, so it ranks behind the narrower deployer routes |
| Standard schemas | `userParametersSchema` on four routes, and none on `publishReleaseNotes` |
| Unparsed UserParameters | `AnnounceRelease` sets a value that is not JSON, so the handler gets the raw string |
| Router client | `createCodePipelineRouter({ client })`, so the route check can record job results |
| Router middleware | `logJob` runs once per job |
| Route middleware | `withReleaseContext` on the verify route |
| Output variables | `verifyReleaseBundle` returns `bundleSha`, which `CanaryDeploy` reads back as UserParameters |
| Artifact credentials | `verifyReleaseBundle` writes its output artifact with the credentials on the job |
| Continuation token | `startCanaryDeployment` returns one, `awaitCanaryHealth` reads it and returns one more |
| Empty success | `publishReleaseNotes` returns nothing, so its job succeeds with no variables |
| No route matched | `ReconcileLedger` carries a step no filter claims |
| Handler failure | `RollbackRelease` throws after its middleware has run |
| Schema failure | `VerifyRollbackBundle` sets no `environment` |

CDK injects both function names as env vars, and `src/environment.ts` reads them. The `functionName`
filters match against those values.

A missing name throws at cold start. An empty filter string reads as no filter at all, which would
let one route claim every job.

Handlers do their work by logging, and the router reports every job back to CodePipeline. The
CloudWatch logs are how you confirm routing.

## Prerequisites

- AWS account with credentials on the shell
- CDK bootstrap already run for the target account / region
- `AWS_REGION` set to the region the stack is deployed in
- Node 24 and pnpm installed

## Permissions

`deploy-policy.json` holds the minimum permissions needed to deploy this example and test it. Attach
it to the user or role you run the commands with.

CloudFormation work is done by the CDK bootstrap roles, so the policy only allows assuming those
roles. The rest covers uploading the release bundle, starting an execution and reading the worker
logs. Actions are locked down, resources are not.

Note: the policy assumes the default bootstrap qualifier `hnb659fds`. Change the role and parameter
ARNs if your account uses a custom one.

## Deploy

From this directory:

```bash
pnpm -F @lambda-event-router/service-example-codepipeline... install
pnpm -F @lambda-event-router/service-example-codepipeline... run build
pnpm -F @lambda-event-router/service-example-codepipeline run deploy
```

CDK outputs include `ReleaseBucketName`, `PipelineName` and `WorkerLogGroupName`.

To check the routing table without deploying, run
`pnpm -F @lambda-event-router/service-example-codepipeline run check`. It drives the built router with
a synthetic job for each route and reports where each one landed.

Note: creating a pipeline starts an execution of its own. That one fails at `FetchReleaseBundle`,
because no bundle has been uploaded yet, and no Lambda runs.

## Start a sample execution

Pass the bucket name from the deploy outputs:

```bash
pnpm -F @lambda-event-router/service-example-codepipeline run release <ReleaseBucketName>
```

The script writes a fresh `release.zip` to the bucket and starts an execution. Each run overwrites
the bundle and starts another execution, so a second run needs no teardown after the first.

The source action reads the bucket only when an execution starts. An upload on its own starts
nothing, so two runs cannot race each other.

The execution takes about three minutes. Each Lambda action costs roughly 30 seconds of CodePipeline
polling whatever the handler does, and the canary action pays that three times.

The execution ends as `Failed`. The last stage is three actions that fail on purpose, one per
failure the router can produce.

CodePipeline delivers one job per invocation. There is no batch delivery, so there is no ordering or
partial-failure behaviour to show.

## Checking the logs

Once the execution has finished, read what CodePipeline made of each action and save the worker logs
to a file:

```bash
aws codepipeline list-action-executions --pipeline-name ler-example-codepipeline-release
aws logs tail /aws/lambda/ler-example-codepipeline-worker --since 15m --format short > worker.log
```

The action list is the router's other half. Every failure the router reports goes out through
`PutJobFailureResult`, and its message lands on the action as `externalExecutionSummary`. The three
`Recover` actions carry `Rollback target unavailable`, `No route matched` and
`UserParameters validation failed`, one each.

Both functions write to that one log group, so one export covers the whole run. Each log stream is
named after the function that wrote it, and every `Handling CodePipeline job` line carries
`functionName`.

Widen the window with `--since`, which takes a single unit such as `30m`, `2h` or `1d`. The worker
logs in JSON, so a handler field such as `bundleSha` sits under `message` rather than at the top
level.

Use `aws logs filter-log-events` when you want to parse the file. `aws logs tail --format json`
writes a header line before each event, so the file will not parse.

Note: the log group is `/aws/lambda/<stackName>-worker`, so the name changes if you deploy with a
different `stackName`.

The log holds eight invocations. Five reach a handler and three fail.

The five that succeed log what they did:

- `Release context resolved` then `Release bundle verified`, which is route middleware before its
  handler. The second line names both artifacts and their object keys. The handler has by then written
  `VerificationReport` to the artifact store, using the credentials CodePipeline put on the job.
  `ReconcileLedger` takes that artifact as an input, so the pipeline fails if the upload did not
  land.
- `Canary deployment started` carries a `bundleSha`. That value is what `verifyReleaseBundle`
  returned. It went out as a CodePipeline output variable and came back as UserParameters on the next
  action.
- `Canary still warming up` carries `continuationToken` `canary-1`. The token the previous
  invocation returned arrived on this one, and `continuation()` is what routed it here rather than to
  `startCanaryDeployment`. A job with no token has no `continuationToken` field at all, which is what
  the `hasContinuationToken` filter reads.
- `Canary healthy` carries `continuationToken` `canary-2`. Returning nothing ends the action.
- `Release notes published` carries `userParameters` `releases`, a plain string. That action's
  UserParameters is not JSON, so the router hands the value over as it stands. It is also the only
  job the `functionName` filter sends anywhere but the deployer routes.

Three `ERROR` records carry the failures. Each one has `errorMessage` and a `stackTrace`:

- `Rollback target unavailable for job <id>` comes from the handler. That job has a
  `Handling CodePipeline job` line, because the handler ran.
- `No route matched for CodePipeline job <id> (function: ler-example-codepipeline-deployer)` is
  `ReconcileLedger`. Its step is claimed by no filter, and it carries an artifact, so
  `rollbackRelease` will not take it either.
- `UserParameters validation failed for job <id>` is `VerifyRollbackBundle`. That record also carries
  `issues`, which names `environment` as the field that failed.

Read `name` rather than `errorType` on the validation record. The bundle is minified, so `errorType`
holds a mangled class name for `SchemaValidationError`. The other two throw a plain `Error`, which
has no `name` and an `errorType` of `Error`.

Six of the eight invocations have a `Handling CodePipeline job` line. The two that failed routing or
validation have none. The router matches a route and validates UserParameters before it runs any
middleware.

Note: an invocation whose handler threw still reports `status` `success` in its `platform.report`
line, and that record carries no error field. Count the `ERROR` records instead.

## Pipeline and routes

| Stage | Action | Function | Route |
| --- | --- | --- | --- |
| Source | `FetchReleaseBundle` | none | none |
| Verify | `VerifyBundle` | deployer | `verifyReleaseBundle`, which writes `VerificationReport` |
| Deploy | `CanaryDeploy` | deployer | `startCanaryDeployment`, then `awaitCanaryHealth` twice |
| Deploy | `AnnounceRelease` | notifier | `publishReleaseNotes` |
| Recover | `RollbackRelease` | deployer | `rollbackRelease` |
| Recover | `ReconcileLedger` | deployer | none |
| Recover | `VerifyRollbackBundle` | deployer | `verifyReleaseBundle` |

The three `Recover` actions share a run order, so all three run before the stage gives up.

An action that declares an output artifact has to upload it, or CodePipeline fails the action.
`request.artifactCredentials` is how a Lambda action gets write access to the artifact store.
`src/utils/artifactStore.ts` is where those credentials become an S3 client.

A pipeline has to start with a source stage, and every source is a second service. S3 is the
lightest, and CodePipeline needs an S3 artifact store whatever source you pick. One bucket does both
jobs here.

Both functions set `retryAttempts` to 0, which caps Lambda's async retries. The router reports the
job as failed before the handler's error reaches Lambda, so a retry would only repeat a failure
CodePipeline has recorded.

## Iterating

```bash
pnpm -F @lambda-event-router/service-example-codepipeline run diff   # review pending changeset
pnpm -F @lambda-event-router/service-example-codepipeline run watch  # hotswap deploys
pnpm -F @lambda-event-router/service-example-codepipeline run synth  # render template
```

## Tear down

```bash
pnpm -F @lambda-event-router/service-example-codepipeline run destroy
```

That removes the pipeline, both functions, the shared log group and the bucket. The bucket empties
itself first, and execution history goes with the pipeline.

CDK's own helper leaves one log group behind, named
`ler-example-codepipeline-CustomS3AutoDeleteObjects` with a random suffix. Delete it by hand if you
want the account clean.
