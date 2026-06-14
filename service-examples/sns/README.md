# Service example: SNS

A deployable CDK app that exercises the `SNSRouter` end to end. It models an order fulfilment service.
One Lambda subscribes to three SNS topics, and the router does the per-record dispatch.

```
orders
├── expediteOrder         (custom filter: body.shippingSpeed === 'express')
├── cancelOrder           (subject filter: 'Order cancelled')
├── chargeCard            (messageAttributes filter: eventType = 'PaymentRequested', always throws)
└── processOrder          (messageAttributes filter: eventType = 'OrderPlaced')

inventory
└── reserveStock          (messageAttributes filter: schemaVersion = '2')

delivery-failures
└── recordDeliveryFailure (topicArn filter)
```

SNS delivers one record per invocation. There is no batch, no ordering and no partial failure, so a
failing record always fails its own invocation.

The delivery failures topic is Lambda's on-failure destination. A record that runs out of retries is
republished there, and the worker subscribes to it as well, so dead lettering stays inside SNS.

No subscription carries a filter policy. AWS delivers every published message to the worker, and the
router does all the filtering.

## What it covers

One `publish:messages` puts a batch on the orders topic and a batch on the inventory topic. Together
they hit every filter the router has, every attribute type and every failure path.

| Feature | Where |
| --- | --- |
| `topicArn` filter | `recordDeliveryFailure` matches the delivery failures topic by ARN |
| `subject` filter | `cancelOrder` matches the subject `Order cancelled` |
| `messageAttributes` filter | `processOrder` matches `eventType`, `reserveStock` matches `schemaVersion` |
| `custom` filter | `expediteOrder` catches express orders before the `eventType` filter |
| Attribute types | `processOrder` takes a Number, a String.Array and a Binary attribute |
| Zod schemas | `bodySchema` on five routes, `messageAttributesSchema` on `processOrder` |
| Router middleware | `logDelivery` runs once per record, on every topic |
| Route middleware | `withOrderContext` on `processOrder` |
| No route matched | An order with no subject and no attributes, and a version 1 stock message |
| Handler failure | `chargeCard` throws after its middleware has run |
| Schema failures | A missing `total`, a `priority` that will not coerce, and a body that is not JSON |
| Retries | Every failing record is invoked twice |
| Dead lettering | The second failure is republished to the delivery failures topic |

SNS delivers every message attribute to Lambda as a String or a Binary. A Number arrives as its digits,
and a String.Array as its JSON text. `OrderAttributesSchema` converts both back. Only the Binary
reaches the handler as a `Buffer`.

Filters run before any schema, so they see those same strings. That is why `reserveStock` matches
`schemaVersion: '2'` and not the number.

CDK injects all three topic ARNs as env vars, and `src/config.ts` reads them. The `topicArn` filter
matches against those values.

Handlers do their work by logging, so the CloudWatch logs are how you confirm routing. The router
returns nothing, so there is no response to assert.

## Prerequisites

- AWS account with credentials on the shell
- CDK bootstrap already run for the target account / region
- Node 24 and pnpm installed

## Permissions

`deploy-policy.json` holds the minimum permissions needed to deploy this example and test it. Attach
it to the user or role you run the commands with.

CloudFormation work is done by the CDK bootstrap roles, so the policy only allows assuming those
roles. The rest covers publishing to the topics and reading the worker logs. Actions are locked down,
resources are not.

Note: the policy assumes the default bootstrap qualifier `hnb659fds`. Change the role and parameter
ARNs if your account uses a custom one.

## Deploy

From this directory:

```bash
pnpm -F @lambda-event-router/service-example-sns build
pnpm -F @lambda-event-router/service-example-sns run deploy
```

CDK outputs include `OrdersTopicArn`, `InventoryTopicArn` and `DeliveryFailuresTopicArn`.

## Publish sample messages

Pass the orders and inventory topic ARNs from the deploy outputs:

```bash
pnpm -F @lambda-event-router/service-example-sns run publish:messages \
  <OrdersTopicArn> <InventoryTopicArn>
```

That is one `PublishBatch` per topic: eight order messages and two inventory messages. Six of the ten
are meant to fail.

The script takes its region from the topic ARN, so it does not need `AWS_REGION` set.

Note: the script is `publish:messages` rather than `publish`, because `pnpm publish` is a pnpm command
of its own. Run it with `run` as shown.

## Checking the logs

Wait about two minutes after publishing. The first attempt is immediate, the retry follows about a
minute later, and the delivery failure reaches its topic within seconds of that.

Save the worker logs to a file:

```bash
aws logs tail /aws/lambda/ler-example-sns-worker --since 10m --format short > worker.log
```

Widen the window with `--since`, which takes a single unit such as `30m`, `2h` or `1d`. Add `--follow`
to keep writing to the file while you publish more messages. The worker logs in JSON, so
`--format json` pretty prints the fields.

Note: the log group is `/aws/lambda/<stackName>-worker`, so the name changes if you deploy with a
different `stackName`.

Ten published messages produce 22 invocations: 4 that succeed, 12 failing attempts and 6 delivery
failures.

There is one `Handling SNS record` line per record that reaches a handler, so 12 in all. A record that
matches no route, or fails a schema, never gets one. The router matches and validates before it runs
middleware.

Four messages are handled:

- `Order accepted for fulfilment` for `ord-1001`, the message carrying one attribute of each type.
- `Order sent to the express courier` for `ord-1002`. It matches `processOrder`'s `eventType` filter as
  well, but the custom filter is registered first and wins.
- `Order cancelled` for `ord-1001`. That message carries no attributes, so the subject is the only
  thing that could match it.
- `Stock reserved` for `SKU-77`, matched on `schemaVersion` alone.

Two fields on the `Order accepted for fulfilment` line carry the rest:

- `coercedTypes` reads `priority: 'number'`, `warehouses: true` and `checksum: true`. Only the
  `checksum` arrived as a `Buffer`. The other two were strings until the schema coerced them.
- `orderId` is there because `withOrderContext` called `appendKeys`, not because the handler logged it.

Six messages fail. Each logs an ERROR line from the Lambda runtime, and `errorMessage` tells them
apart:

- `Payment gateway declined order ord-1002` comes from the handler. That record has a
  `Handling SNS record` line, because the handler ran.
- `No route matched for record from <orders topic ARN>` is the order with no subject and no attributes.
- `No route matched for record from <inventory topic ARN>` is the version 1 stock message.
- `Body validation failed for record <id>` appears twice. One order has no `total`, the other is not
  JSON and reaches the schema as a raw string.
- `Message attributes validation failed for record <id>` is the `priority` of `soon`.

Each of those six is invoked twice, once and then again on the retry, so the same error appears under
two request ids.

Six `Order dead lettered` lines follow, one per failing message. Each carries `failedMessageId`, the
SNS message id of the order that failed, and repeats its `errorMessage`. They come from
`recordDeliveryFailure`, so they are how you tell that Lambda's on-failure destination fired.

## Topics and routes

| Topic | Routes |
| --- | --- |
| `OrdersTopic` | `expediteOrder`, `cancelOrder`, `chargeCard`, `processOrder` |
| `InventoryTopic` | `reserveStock` |
| `DeliveryFailuresTopic` | `recordDeliveryFailure` |

The worker allows one retry and then publishes the failed invocation to `DeliveryFailuresTopic`.

## Iterating

```bash
pnpm -F @lambda-event-router/service-example-sns diff   # review pending changeset
pnpm -F @lambda-event-router/service-example-sns watch  # hotswap deploys
pnpm -F @lambda-event-router/service-example-sns synth  # render template
```

## Tear down

```bash
pnpm -F @lambda-event-router/service-example-sns destroy
```

The stack owns its log group, so `destroy` removes the topics, the subscriptions, the worker and the
logs. Nothing is left behind.
