# Full example: Secrets Manager, EventBridge and CloudWatch security with Terraform

A Terraform app that sends three security signals to one Lambda. Each signal pushes a CloudWatch
metric, and one alarm watches that metric.

```
EventBridge schedule (1h)
└── securityFn / checkRotationAge (eventBridgeMatcher)
    └── DescribeSecret on the demo secret

Secrets Manager rotation of the demo secret
├── securityFn / createPendingSecret (secretsManagerMatcher, createSecret)
├── securityFn / sendToDownstream (secretsManagerMatcher, setSecret)
├── securityFn / checkPwnedPasswords (secretsManagerMatcher, testSecret)
│   └── Pwned Passwords range API
└── securityFn / promotePendingSecret (secretsManagerMatcher, finishSecret)

Log group /secretsmanager-eventbridge-cloudwatch-security/app
└── Subscription filter on FAILED_LOGIN
    └── securityFn / reportFailedLogins (cloudWatchLogsMatcher)

Any issue
└── CloudWatch metric SecurityMonitoring/SecurityIssue
    └── CloudWatch alarm (>= 1 in a minute)
```

The steps to run it are in [Prerequisites](#prerequisites), [Permissions](#permissions)
and [Deploy](#deploy).

There are 6 routes on one Lambda function. `src/index.ts` has one `Latcher` that combines all
three matchers. Each matcher has a small middleware from `src/middleware/logInvocation.ts`. It logs one
line before every route runs.

## What each route does

- `checkRotationAge` flags the demo secret if it has never been rotated or was last rotated over 30
  days ago.
- `createPendingSecret` writes a random 32-character value to the `AWSPENDING` stage.
- `sendToDownstream` logs a line where a real app would send the value to the system that uses it.
- `checkPwnedPasswords` checks the pending value against Have I Been Pwned. A value found in a breach
  fails the rotation.
- `promotePendingSecret` moves `AWSCURRENT` to the new version.
- `reportFailedLogins` counts the `FAILED_LOGIN` lines written to the app log group.

No route logs a secret value. `checkPwnedPasswords` sends only the first 5 characters of the value's
SHA-1 hash to the API.

## Config and GuardDuty

This example leaves out AWS Config rules and GuardDuty findings, although both are common security
signals. Each one needs setup that applies to the whole account. A Config rule needs the region's
single configuration recorder. GuardDuty needs a detector for the region.

A full example must deploy and tear down with nothing left behind in the account. So every signal
here comes from a resource that Terraform creates and destroys.

The `ConfigMatcher` is shown in the [Config service example](../../service-examples/config/).

## Prerequisites

- AWS account with credentials on the shell
- `AWS_REGION` set to the region to deploy to
- Terraform 1.10 or later
- Node 24 and pnpm installed

## Permissions

`deploy-policy.json` holds the permissions needed to deploy this example and test it. Attach it to
the user or role you run the commands with.

Terraform calls each AWS API with your credentials, so the policy covers creating and deleting every
resource. It also covers invoking the function, rotating the secret and reading the logs. Actions
are locked down, resources are not.

## Deploy

```bash
pnpm -F @latcher/full-example-secretsmanager-eventbridge-cloudwatch-security... install
pnpm -F @latcher/full-example-secretsmanager-eventbridge-cloudwatch-security... build
pnpm -F @latcher/full-example-secretsmanager-eventbridge-cloudwatch-security run init
pnpm -F @latcher/full-example-secretsmanager-eventbridge-cloudwatch-security run deploy
```

`deploy` bundles `src/index.ts` into `dist/` with esbuild, then runs `terraform apply`. Terraform does
not build TypeScript, so the bundle step always runs first.

Terraform keeps its state in `terraform/terraform.tfstate`. Do not delete it while the example is
deployed, because `destroy` needs it.

## Playing around

Run these from this directory. The first block reads the Terraform outputs.

```bash
export FN=$(terraform -chdir=terraform output -raw function_name)
export SECRET_ARN=$(terraform -chdir=terraform output -raw secret_arn)
export APP_LOG_GROUP=$(terraform -chdir=terraform output -raw app_log_group)
export ALARM=$(terraform -chdir=terraform output -raw alarm_name)

# 1. Run the rotation age check now instead of waiting for the hourly schedule
aws lambda invoke --function-name "$FN" --cli-binary-format raw-in-base64-out \
  --payload '{"version":"0","id":"manual","detail-type":"Scheduled Event","source":"aws.events","account":"000000000000","time":"2026-01-01T00:00:00Z","region":"eu-west-2","resources":[],"detail":{}}' \
  /dev/null

# 2. Rotate the secret
aws secretsmanager rotate-secret --secret-id "$SECRET_ARN"

# 3. Run the rotation age check again, after the rotation has finished
aws lambda invoke --function-name "$FN" --cli-binary-format raw-in-base64-out \
  --payload '{"version":"0","id":"manual","detail-type":"Scheduled Event","source":"aws.events","account":"000000000000","time":"2026-01-01T00:00:00Z","region":"eu-west-2","resources":[],"detail":{}}' \
  /dev/null

# 4. Write two failed logins and one good login to the app log group
aws logs create-log-stream --log-group-name "$APP_LOG_GROUP" --log-stream-name manual
aws logs put-log-events --log-group-name "$APP_LOG_GROUP" --log-stream-name manual --log-events \
  "[{\"timestamp\":$(date +%s000),\"message\":\"FAILED_LOGIN user=alice ip=203.0.113.7\"},
    {\"timestamp\":$(date +%s001),\"message\":\"FAILED_LOGIN user=alice ip=203.0.113.7\"},
    {\"timestamp\":$(date +%s002),\"message\":\"LOGIN user=bob ip=198.51.100.4\"}]"

# 5. Read the alarm state
aws cloudwatch describe-alarms --alarm-names "$ALARM" --query 'MetricAlarms[0].StateValue'
```

Steps 1 and 3 invoke the function directly, because EventBridge does not let you publish an
`aws.events` event. The matcher only checks the source, the detail type and that `detail` is an object.

Step 4 reuses the `manual` log stream. Run `create-log-stream` once only, or change the stream name.

Step 5 shows `ALARM` within a minute or two of step 1 or step 4. It goes back to `OK` about 5 to 10
minutes after the last issue.

## Checking the logs

Save the function logs to a file:

```bash
aws logs tail /aws/lambda/secretsmanager-eventbridge-cloudwatch-security --since 10m --format short > security.log
```

Each route's log line comes after a `Handling ...` line from the middleware. You see, in order:

1. Step 1 logs `Secret has never been rotated`, because the deploy does not rotate the secret.
2. Step 2 logs four `Handling rotation step` lines, one per step. Their route lines are
   `Pending secret created`, `Pending secret sent to downstream`, `Pending secret not found in any
   breach` and `Secret promoted to AWSCURRENT`.
3. Step 3 logs `Secret rotation is up to date` with `ageDays: 0`.
4. Step 4 logs `Failed logins found` with the two `FAILED_LOGIN` lines. The `LOGIN` line does not
   match the subscription filter, so it never reaches the function.

Note: the rotation runs in the background. If step 3 runs before step 2 has finished, it logs
`Secret has never been rotated` again.

## Iterating

```bash
pnpm -F @latcher/full-example-secretsmanager-eventbridge-cloudwatch-security plan       # review pending changes
pnpm -F @latcher/full-example-secretsmanager-eventbridge-cloudwatch-security run deploy # bundle and apply
```

## Tear down

```bash
pnpm -F @latcher/full-example-secretsmanager-eventbridge-cloudwatch-security destroy
```

This deletes the function, the secret, both log groups, the schedule and the alarm. The secret is
deleted with no recovery window, so you can deploy again straight away.
