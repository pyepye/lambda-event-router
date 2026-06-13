# Service example: SQS

A deployable CDK app that exercises the `SQSRouter` end to end. It models a notifications dispatcher.
One Lambda consumes two SQS queues, and the router does the final per-record dispatch.

```
notifications (standard queue)
├── holdMarketing        (custom filter: body.category === 'marketing')
├── sendEmail            (messageAttributes filter: channel = 'email')
└── failDelivery         (messageAttributes filter: channel = 'sms', always throws)

priority.fifo (FIFO queue)
└── deliverPriorityAlert (eventSourceArn filter, ordered per tenant)
```

## What it covers

One `send` puts a batch on each queue. Together they hit every filter type, both kinds of failure and
the FIFO grouping paths.

| Feature | Where |
| --- | --- |
| `custom` filter | `holdMarketing` catches marketing sends before the channel filter |
| `messageAttributes` filter | `sendEmail` matches `channel: 'email'`, `failDelivery` matches `sms` |
| `eventSourceArn` filter | `deliverPriorityAlert` matches the FIFO queue by ARN |
| Number attributes | `retryCount` is sent as a Number, so the handler receives a number |
| Zod schemas | `bodySchema` on every route, `messageAttributesSchema` on `sendEmail` |
| Router middleware | `logInvocation` runs once per record |
| Route middleware | `withAlertContext` on the priority route |
| Batch item failures | `createSQSRouter({ batchItemFailures: true })`, both event sources report them |
| No route matched | A notification with no `channel` attribute and no marketing category |
| Handler failure | `failDelivery` throws after its middleware has run |
| Schema failures | A missing `subject`, a `retryCount` that will not coerce, and a body that is not JSON |
| FIFO ordering | The three `tenant-99` alerts run in order in one invocation |
| FIFO group failure | `tenant-42` fails on `a-2`, so `a-3` never runs |

CDK injects both queue ARNs as env vars, and `src/config.ts` reads them. The `eventSourceArn` filters
match against those values.

Handlers do their work by logging, so the CloudWatch logs are how you confirm routing.

## Prerequisites

- AWS account with credentials on the shell
- CDK bootstrap already run for the target account / region
- Node 24 and pnpm installed

## Permissions

`deploy-policy.json` holds the minimum permissions needed to deploy this example and test it. Attach
it to the user or role you run the commands with.

CloudFormation work is done by the CDK bootstrap roles, so the policy only allows assuming those
roles. The rest covers sending to the queues and reading the worker logs. Actions are locked down,
resources are not.

Note: the policy assumes the default bootstrap qualifier `hnb659fds`. Change the role and parameter
ARNs if your account uses a custom one.

## Deploy

From this directory:

```bash
pnpm -F @lambda-event-router/service-example-sqs build
pnpm -F @lambda-event-router/service-example-sqs run deploy
```

CDK outputs include `NotificationsQueueUrl`, `PriorityQueueUrl`, `NotificationsDlqUrl` and
`PriorityDlqUrl`.

## Send sample messages

Pass the two queue URLs from the deploy outputs:

```bash
pnpm -F @lambda-event-router/service-example-sqs send \
  <NotificationsQueueUrl> <PriorityQueueUrl>
```

That is one batch per queue: seven notifications and six priority alerts. Five notifications and one
alert are meant to fail.

Each queue is sent as one batch on purpose. Partial batch failures and FIFO ordering only show up
when several records reach one invocation.

Lambda decides how many records that is, and there is no setting that forces it. Expect the seven
notifications to spread across a few invocations, with at least one holding a success and a failure
together. The FIFO groups usually get an invocation each.

## Checking the logs

Save the worker logs to a file:

```bash
aws logs tail /aws/lambda/ler-example-sqs-worker --since 10m --format short > worker.log
```

Widen the window with `--since`, which takes a single unit such as `30m`, `2h` or `1d`. Add
`--follow` to keep writing to the file while you send more messages. The worker logs in JSON, so
`--format json` pretty prints the fields.

Note: the log group is `/aws/lambda/<stackName>-worker`, so the name changes if you deploy with a
different `stackName`.

There is one `logInvocation` line per record that reaches a handler.

Two notifications are handled:

- `Email sent` for the receipt. `retryCount` is the number 2, not the string AWS sends.
- `Marketing notification held for batching` for the sale email. It matches the channel filter as
  well, but the custom filter is registered first and wins.

Five notifications fail. Each one logs `Error processing SQS record <id>`, and the `errorMessage`
tells them apart:

- `SMS gateway unavailable` comes from the handler. That record has a `logInvocation` line, because
  the handler ran.
- `No route matched` is the message with no `channel` attribute.
- `Body validation failed` appears twice. One message has no `subject`, the other is not JSON.
- `Message attributes validation failed` is the `retryCount` of `soon`.

The priority queue shows the FIFO paths:

- `tenant-99` delivers `b-1`, `b-2` then `b-3` in order, inside one invocation. The router produces
  that order, because it walks a message group one record at a time.
- `tenant-42` delivers `a-1`, fails on `a-2`, and never runs `a-3`. A failure stops the rest of its
  group, so `a-3` never appears in the log.
- The two groups usually arrive in separate invocations, because Lambda tends to send one message
  group per batch.
- `a-2` and `a-3` retry once a minute. The third receive puts both in `PriorityDlq`, so a valid
  record is dead-lettered behind a broken one.

Note: no record that fails validation has a `logInvocation` line. The router validates before it runs
middleware.

## Queues and routes

| Queue | Type | Routes |
| --- | --- | --- |
| `NotificationsQueue` | standard | `holdMarketing`, `sendEmail`, `failDelivery` |
| `PriorityQueue` | FIFO | `deliverPriorityAlert` |

Both queues have a dead letter queue with `maxReceiveCount` 3.

## Iterating

```bash
pnpm -F @lambda-event-router/service-example-sqs diff   # review pending changeset
pnpm -F @lambda-event-router/service-example-sqs watch  # hotswap deploys
pnpm -F @lambda-event-router/service-example-sqs synth  # render template
```

## Tear down

```bash
pnpm -F @lambda-event-router/service-example-sqs destroy
```
