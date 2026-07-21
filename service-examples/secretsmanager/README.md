# Service example: Secrets Manager

A deployable CDK app that exercises the `SecretsManagerRouter` end to end. It models credential
rotation for an internal platform. One Lambda is the rotation function for five secrets, and the
router dispatches each of the four rotation steps.

The steps to run it are in [Prerequisites](#prerequisites), [Permissions](#permissions)
and [Deploy](#deploy).

```
payments/api-token
├── createPendingToken   (createSecret, a list of an ARN, a regex and a name pattern)
├── announceRotation     (setSecret, a list of name patterns)
├── verifyPaymentsToken  (testSecret, exact ARN plus a custom filter)
└── promoteToken         (finishSecret, a list of name patterns)

webhooks/signing-key
├── createPendingToken   (createSecret, matched by regex)
├── checkWebhookKey      (setSecret and testSecret, one route with a step list)
└── promoteToken         (finishSecret)

search/index-key
├── createPendingToken   (createSecret, matched by a name pattern)
├── announceRotation     (setSecret)
└── rejectIndexKey       (testSecret, regex filter, always throws)

legacy/ftp-password
└── holdPausedRotation   (all four steps, async custom filter on the RotationPaused tag)

retired/report-token
└── no route matches
```

## What it covers

One `rotate` starts a rotation on each of the five secrets. Between them they hit every filter the
router has. They also cover both kinds of failure and the two routes that win on registration order.

| Feature | Where |
| --- | --- |
| `secretId` exact string | `verifyPaymentsToken` matches the ARN CDK injects |
| `secretId` wildcard | `checkWebhookKey` matches `*/webhooks/*` |
| `secretId` regex | `rejectIndexKey` matches `/search\/index-key/` |
| `secretId` list | `createPendingToken` mixes an ARN, a regex and a name pattern |
| `secretId` name matching | `announceRotation` filters on names that no ARN can match |
| `step` methods | `.createSecret()`, `.setSecret()`, `.testSecret()` and `.finishSecret()` |
| `step` list | `checkWebhookKey` takes both `setSecret` and `testSecret` |
| No `step` filter | `holdPausedRotation` catches all four steps |
| `custom` filter, async | `holdPausedRotation` reads the secret's tags before it matches |
| `custom` filter, sync | `verifyPaymentsToken` checks a list held in code |
| Router middleware | `logRotationStep` runs once per rotation event |
| Route middleware | `withSecretContext` on the `createSecret` route |
| Registration order | `holdPausedRotation` and `checkWebhookKey` each beat a later route that also matches |
| No route matched | `retired/report-token` has a rotation schedule but no route |
| Handler failure | `rejectIndexKey` throws after its middleware has run |

The router takes no schemas, so there is no validation step and no validation failure to show.

CDK injects the payments secret ARN as an env var, and `src/config.ts` reads it. The exact string
`secretId` filter matches against that value.

Handlers do the real rotation work and log what they did, so the CloudWatch logs are how you confirm
routing.

## Prerequisites

- AWS account with credentials on the shell
- CDK bootstrap already run for the target account / region
- Node 24 and pnpm installed

## Permissions

`deploy-policy.json` holds the minimum permissions needed to deploy this example and test it. Attach
it to the user or role you run the commands with.

CloudFormation work is done by the CDK bootstrap roles, so the policy only allows assuming those
roles. The rest covers starting the rotations and purging the secrets on tear down. It also allows
reading the worker logs. Actions are locked down, resources are not.

Note: the policy assumes the default bootstrap qualifier `hnb659fds`. Change the role and parameter
ARNs if your account uses a custom one.

## Deploy

From this directory:

```bash
pnpm -F @lambda-event-router/service-example-secretsmanager... install
pnpm -F @lambda-event-router/service-example-secretsmanager... build
pnpm -F @lambda-event-router/service-example-secretsmanager run deploy
```

CDK outputs include `WorkerLogGroupName` and `PaymentsTokenArn`.

Deploying runs no rotation, but it does invoke the worker five times. Secrets Manager checks it can
call the function as each rotation schedule is created, and that check arrives as a `testSecret`
event. The pending version it names is already readable, so the verify handlers pass on it. Those
five lines sit in the log ahead of anything the trigger does.

## Rotate sample secrets

```bash
AWS_REGION=eu-west-2 pnpm -F @lambda-event-router/service-example-secretsmanager run rotate
```

The script takes no arguments. It holds the five secret names and the stack creates them with exactly
those names. Set `AWS_REGION` to the region you deployed to.

One run is at least sixteen invocations: four steps each for `payments/api-token`,
`webhooks/signing-key` and `legacy/ftp-password`, three for `search/index-key` and one for
`retired/report-token`. Each step is one invocation, so there is no batch or ordering behaviour to
show here.

Secrets Manager sometimes runs a step twice inside one attempt, under the same `clientRequestToken`
but a fresh `rotationToken`. A round can therefore be longer than sixteen. It is why the handlers
are written to be safe to run again.

Only `payments/api-token` and `webhooks/signing-key` finish. The other three stop short, each for a
different reason, and Secrets Manager retries an unfinished rotation about every 100 seconds. A retry
replays the whole rotation from `createSecret`, so the log keeps growing until you tear the stack
down.

Running the script again works with no teardown. A finished rotation leaves `AWSPENDING` on the
version it promoted, so the script clears that label on all five secrets before starting the next
round.

## Checking the logs

Wait about 30 seconds for the round to finish, then save the worker logs to a file:

```bash
aws logs tail /aws/lambda/ler-example-secretsmanager-worker --since 10m --format short > worker.log
```

Widen the window with `--since`, which takes a single unit such as `30m`, `2h` or `1d`. Add
`--follow` to keep writing to the file as the retries come in. The worker logs in JSON, so
`--format json` pretty prints the fields.

Note: the log group is `/aws/lambda/<stackName>-worker`, so the name changes if you deploy with a
different `stackName`.

There is a `Handling rotation step` line for every event that matched a route, fifteen in the
shortest round. Each carries the step, the secret ARN, the `clientRequestToken` and the
`rotationToken`. The client request token names the version being rotated and holds for a whole
attempt. The rotation token changes on every invocation.

`payments/api-token` rotates cleanly through all four steps:

- `Pending token created` comes from `createSecret`. The line also carries `secretName`, which the
  route middleware added.
- `Pending token announced` comes from `setSecret`.
- `Pending payments token verified` comes from `testSecret`. Both the exact ARN filter and the custom
  filter had to pass for that route to match.
- `Token promoted to AWSCURRENT` comes from `finishSecret`, with the version id it took the label
  off.

`webhooks/signing-key` rotates cleanly as well, and shows the step list:

- `Webhook signing key checked` appears twice, once with a `step` of `setSecret` and once with
  `testSecret`. One route serves both.
- `announceRotation` matches this secret on `setSecret` too, but `checkWebhookKey` is registered
  first and wins.

`search/index-key` fails inside a handler:

- `Pending token created` and `Pending token announced` run first.
- `Search cluster rejected the pending key` is the handler throwing.
- That event still has a `Handling rotation step` line, because the middleware ran before the handler
  did.
- There is no `finishSecret` line. Secrets Manager stops a rotation at the step that threw.

`legacy/ftp-password` is held on every step:

- `Rotation held, secret is tagged paused` appears four times, once per step. The async custom filter
  read the tag off the secret and matched ahead of every rotation route.
- All four invocations succeed and the rotation still does not finish, because nothing moved
  `AWSCURRENT`.

`retired/report-token` matches nothing:

- `No route matched for Secrets Manager rotation event` is the router refusing the event.
- That event has no `Handling rotation step` line. The router picks a route before it runs middleware.
- Only `createSecret` appears. Secrets Manager gets no further.

`Pending token already created` is `createSecret` finding the version it wrote last time. It shows
whenever Secrets Manager runs that step twice, on a retry or inside a single attempt.

The worker sets `retryAttempts` to 0, so Lambda adds no replays of its own. Every repeated step in
the log came from Secrets Manager.

Note: the `platform.report` line reports a `status` of `success` even when the handler threw, and it
carries no error field at all. Count the `ERROR` records instead, which have `errorType`,
`errorMessage` and a `stackTrace`.

## Secrets and routes

| Secret | Rotation | Routes |
| --- | --- | --- |
| `payments/api-token` | finishes | `createPendingToken`, `announceRotation`, `verifyPaymentsToken`, `promoteToken` |
| `webhooks/signing-key` | finishes | `createPendingToken`, `checkWebhookKey`, `promoteToken` |
| `search/index-key` | stops on `testSecret` | `createPendingToken`, `announceRotation`, `rejectIndexKey` |
| `legacy/ftp-password` | never finishes | `holdPausedRotation` |
| `retired/report-token` | stops on `createSecret` | none |

The table drops the `ler-example-secretsmanager/` prefix that every secret name carries.

All five secrets have a rotation schedule pointing at the worker. The interval is 30 days, so no
schedule fires during a test, and `rotateImmediatelyOnUpdate` is off so creating one runs no rotation.

The rotation event carries `SecretId` as the secret ARN, never the name, and that ARN ends in a six
character suffix Secrets Manager adds. The router takes the name back out of it and hands both to the
filters, so `announceRotation` can be written against names and `verifyPaymentsToken` against the
ARN.

Every event also carries `RotationToken`, which `@types/aws-lambda` leaves out. The router reads it
off the event and puts it on the request as `rotationToken`.

## Iterating

```bash
pnpm -F @lambda-event-router/service-example-secretsmanager diff   # review pending changeset
pnpm -F @lambda-event-router/service-example-secretsmanager watch  # hotswap deploys
pnpm -F @lambda-event-router/service-example-secretsmanager synth  # render template
```

## Tear down

```bash
AWS_REGION=eu-west-2 pnpm -F @lambda-event-router/service-example-secretsmanager run destroy
```

That destroys the stack and then force deletes the five secrets. Destroying takes the rotation
schedules with it, which is what stops the retries.

CloudFormation deletes a secret with a 30 day recovery window, which keeps its name taken. The purge
is what frees the names for the next deploy.
