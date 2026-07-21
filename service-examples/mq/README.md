# Service example: MQ

A deployable CDK app that exercises both Amazon MQ routers end to end. It models an order and payment
pipeline. Two brokers feed a Lambda each, and the router does the per-message dispatch.

The steps to run it are in [Prerequisites](#prerequisites), [Permissions](#permissions)
and [Deploy](#deploy).

The two engines send different event shapes, so `ActiveMQRouter` and `RabbitMQRouter` get a worker
each rather than sharing one.

```
orders (ActiveMQ)
├── order-events
│   ├── escalateUrgentOrder     (custom filter: orderPriority property is urgent)
│   ├── processOrder            (textMessage route)
│   └── archiveOrderLabel       (bytesMessage route, body is a Buffer)
└── order-events-invalid
    └── quarantineOrder         (text only, always throws)

payments (RabbitMQ)
├── payment-events
│   ├── settleHighValuePayment  (custom filter: AMQP priority is 5 or more)
│   ├── capturePayment          (contentType application/json)
│   └── recordPaymentNote       (contentType text/plain, no bodySchema)
├── payment-receipts
│   └── recordPaymentReceipt    (contentType application/json)
├── payment-reviews
│   └── holdPaymentForReview    (always throws)
└── payment-events-invalid
    └── holdPaymentForReview    (the same route, named by a queue filter list)
```

Two more routes are registered ahead of those and never match. `routeToLegacyFulfilment` carries
`escalateUrgentOrder`'s filters against a second broker ARN. `reconcileSettlement` carries
`capturePayment`'s against a second virtual host. Neither the broker nor the host exists. Each message
lands on the route behind them, which is how a rejected filter shows.

Amazon MQ has no partial batch response. A message that throws takes its whole batch with it, and
everything behind it in that batch is never tried.

Every queue carrying a failure therefore takes one message per batch. Share a batch between three
failures and the log shows only the first, until that one leaves the queue.

That is not enough on its own for RabbitMQ. A RabbitMQ mapping gets one execution environment, so a
failing message holds its queue until it expires. Each RabbitMQ failure gets a queue and a mapping of
its own for that reason. ActiveMQ gets five environments per mapping and runs its three in parallel.

Neither engine gives up quickly. ActiveMQ retries a failing message for a minute or two and then drops
it. RabbitMQ retries until the message expires, so the failures are published with a 60 second expiry.

## What it covers

One `publish` run puts seven messages on the ActiveMQ broker and eight on the RabbitMQ one. Together
they hit every filter both routers read, every schema they validate and every way they can fail.

| Feature | Where |
| --- | --- |
| `custom` filter | `escalateUrgentOrder` on a JMS property, `settleHighValuePayment` on the AMQP priority |
| `destination` filter | Splits `order-events` from `order-events-invalid` |
| `messageType` filter | `textMessage()` and `bytesMessage()` set it for `processOrder` and `archiveOrderLabel` |
| `eventSourceArn` filter | `escalateUrgentOrder` matches the broker, `routeToLegacyFulfilment` does not |
| `queue` filter | Splits the four payment queues, and `holdPaymentForReview` names two of them |
| `virtualHost` filter | `capturePayment` matches `/`, `reconcileSettlement` does not |
| `contentType` filter | `capturePayment` takes JSON, `recordPaymentNote` takes `text/plain` |
| Buffer body | `archiveOrderLabel` gets the raw bytes, which is why a bytes route takes no `bodySchema` |
| Non-JSON body | `recordPaymentNote` declares no `bodySchema`, so the note arrives as the string |
| Zod schemas | `bodySchema` on every route that takes one |
| Coerced values | `total` and `amount` are published as strings and reach the handler as numbers |
| Router middleware | `logOrderMessage` and `logPaymentMessage` run once per message |
| Route middleware | `withOrderContext` on the escalation, `withPaymentContext` on the settlement |
| Ordered batch | The four payments reach one invocation, in the order they were sent |
| No route matched | A bytes message on the order failure queue, a receipt with no content type |
| Handler failure | `quarantineOrder` and `holdPaymentForReview` throw after their middleware has run |
| Schema failures | An order with no `currency`, a payment with no `method` |
| Redelivery | `redelivered` is logged, and is true from the second delivery of a message on |
| Dropped after retries | A failure is retried until the broker or the expiry removes it, and nothing is dead lettered |

CDK injects both broker ARNs as env vars, and `src/config.ts` reads them. The `eventSourceArn` filters
match against those values.

Handlers do their work by logging, so the CloudWatch logs are how you confirm routing.

## Prerequisites

- AWS account with credentials on the shell
- CDK bootstrap already run for the target account / region
- Node 24 and pnpm installed

The ActiveMQ broker is an `mq.t3.micro`. RabbitMQ no longer takes that type, so its broker is an
`mq.m7g.medium`, the smallest it does take. With the 200 GB volume that instance carries, the pair
costs about $0.22 an hour in `eu-west-2`. Tear the stack down when you are done.

Creating the stack takes about 13 minutes, almost all of it the brokers. A change to the worker code
alone redeploys in well under a minute.

Both brokers are publicly accessible, and that is the wrong choice for a real system. Lambda reads a
public broker over the internet from addresses AWS does not publish. The ActiveMQ port it polls on,
61617, is therefore open to `0.0.0.0/0`.

The RabbitMQ broker is worse. A public RabbitMQ broker takes no security group and no subnet. Amazon
MQ puts it behind a network load balancer in its own account, and its AMQP port 5671 answers anyone.
A generated 32 character password is all that stands in front of either broker.

The example takes that trade so the VPC costs nothing and the publish script runs on your own machine.
Put the brokers in a private VPC for anything real. That needs a publisher inside the VPC. It also
needs a NAT gateway, or PrivateLink endpoints for Lambda, STS and Secrets Manager.

Note: the `allowedCidr` context value narrows the ActiveMQ STOMP port to one address. Nothing narrows
the RabbitMQ side.

## Permissions

`deploy-policy.json` holds the minimum permissions needed to deploy this example and test it. Attach
it to the user or role you run the commands with.

CloudFormation work is done by the CDK bootstrap roles, so the policy only allows assuming those
roles. The rest covers reading the broker credentials, reading the worker logs and purging the two
secrets. Actions are locked down, resources are not.

An Amazon MQ event source mapping authenticates through Secrets Manager and nothing else. The stack
generates a secret per broker and gives the broker's user the same value. Each worker reads its own
secret through its execution role.

Note: the policy assumes the default bootstrap qualifier `hnb659fds`. Change the role and parameter
ARNs if your account uses a custom one.

## Deploy

From this directory:

```bash
pnpm -F @lambda-event-router/service-example-mq... install
pnpm -F @lambda-event-router/service-example-mq... build
AWS_REGION=eu-west-2 pnpm -F @lambda-event-router/service-example-mq run deploy \
  --context allowedCidr=$(curl -s https://checkip.amazonaws.com)/32
```

CDK outputs include `OrderBrokerStompEndpoint`, `PaymentBrokerAmqpEndpoint`, `OrderWorkerLogGroupName`
and `PaymentWorkerLogGroupName`.

A RabbitMQ mapping needs its queue to exist already, and no CloudFormation resource declares one. A
custom resource opens an AMQP connection once the broker is up and declares all four. ActiveMQ needs
nothing here, because it creates a queue the first time a consumer asks for one.

Note: a mapping does not start reading for a while after it is created. Give the stack two minutes
after the deploy finishes before you publish, or the first run reaches nothing.

## Publish sample messages

Pass the two endpoints from the deploy outputs:

```bash
AWS_REGION=eu-west-2 pnpm -F @lambda-event-router/service-example-mq run publish \
  <OrderBrokerStompEndpoint> <PaymentBrokerAmqpEndpoint>
```

That is seven messages to the ActiveMQ broker and eight to the RabbitMQ one. Six of the fifteen are
meant to fail.

The script reads both passwords from Secrets Manager. It publishes to ActiveMQ over STOMP and to
RabbitMQ over AMQP. STOMP is the one ActiveMQ protocol that lets a client pick the JMS message type: a
`content-length` header makes a bytes message and leaving it off makes a text message. Lambda reads
the broker over OpenWire either way.

Each queue is published as one batch on purpose. Ordering only shows when several messages reach one
invocation. So does the way one failure takes the rest of its batch with it.

Running the command again works with no teardown in between. Wait two minutes first, so the failing
messages from the previous run have gone.

## Checking the logs

Wait two minutes after publishing, so the failures have drained, then save both worker logs to a
file:

```bash
aws logs tail /aws/lambda/ler-example-mq-order-worker --since 15m --format short > order-worker.log
aws logs tail /aws/lambda/ler-example-mq-payment-worker --since 15m --format short > payment-worker.log
```

Widen the window with `--since`, which takes a single unit such as `30m`, `2h` or `1d`. The workers
log in JSON, so `--format json` pretty prints the fields.

Note: the log groups are `/aws/lambda/<stackName>-order-worker` and `-payment-worker`, so the names
change if you deploy with a different `stackName`.

Each worker logs one line per message that reaches a handler, and one more for each redelivery. The
order worker writes `Handling ActiveMQ message` and the payment worker writes `Handling RabbitMQ
message`.

Four orders are handled:

- `Order processed` twice, for O-1001 and O-1003. `total` is the number 129.5, not the string that was
  published.
- `Urgent order escalated` for O-1002, with `Urgent order received` ahead of it from the route
  middleware. It matches the text route too, but the escalation route is registered first.
- `Order label archived` for the shipping label. `bytes` is 15 and `header` is `%PDF`, which is the
  body arriving as a Buffer rather than parsed JSON.

Nothing logs `Order sent to legacy fulfilment`. The urgent order carries everything that route asks
for apart from the broker ARN.

Three orders fail, one message per batch, all three at the same time. Neither router catches an error,
so each failure is Lambda's own `ERROR` record rather than a line a router wrote. `errorMessage` tells
the three apart:

- `Body validation failed for message <id>` is O-9001, which has no `currency`.
- `Order O-9002 needs a fulfilment hold before it can be quarantined` is the handler throwing.
- `No route matched for message <id>` is the bytes message. `quarantineOrder` is the only route for
  that queue and it is pinned to text.

Each of the three is retried for a minute or two and then disappears. Read nothing into the count.
Six runs gave between 11 and 66 `ERROR` records for the same message. Nothing arrives in
`ActiveMQ.DLQ` and the queue ends up empty. The poller gives up and drops the message rather than
dead lettering it.

`redelivered` is false on the first delivery and true after that.

Note: `errorType` is the minified class name, so a schema failure reads as `Rd` rather than
`SchemaValidationError`. The real name is the first word of `stackTrace`.

Five payments are handled:

- `Payment captured` twice, for P-2001 and P-2003.
- `High value payment settled` for P-2002, with `High value payment received` ahead of it. Priority 7
  clears the custom filter, which is registered ahead of the capture route.
- `Payment note recorded` for the operator note. `note` is the raw string, because the route declares
  no `bodySchema` and the text is not JSON.
- `Payment receipt recorded` for R-3001 on the receipts queue.

Nothing logs `Payment reconciled` or `Payment sent to legacy settlement`. Every `Handling RabbitMQ
message` line carries `virtualHost` as `/`. The event keys the queue as `payment-events::/`, and the
router splits the name from the host.

Three payments fail, one queue each, all three at the same time:

- `Body validation failed` is P-9001 on `payment-events-invalid`, which has no `method`.
- `Payment P-9002 needs a review case before it can be held` is the handler throwing on
  `payment-reviews`.
- `No route matched for message on queue payment-receipts` is R-9003, published with no content type.
  `recordPaymentReceipt` is the only route for that queue and it filters on `application/json`.

Each one repeats until its 60 second expiry removes it. Six runs gave between 6 and 48 `ERROR` records
for one message. Lambda slows a mapping's polling down while it keeps failing.

Note: no message that fails validation has a `Handling` line. Both routers validate the body before
they run middleware, so only the two handler failures reach one.

## Brokers and routes

| Broker | Engine | Queue | Batch size | Routes |
| --- | --- | --- | --- | --- |
| `orders` | ActiveMQ | `order-events` | 10 | `escalateUrgentOrder`, `processOrder`, `archiveOrderLabel` |
| `orders` | ActiveMQ | `order-events-invalid` | 1 | `quarantineOrder` |
| `payments` | RabbitMQ | `payment-events` | 10 | `settleHighValuePayment`, `capturePayment`, `recordPaymentNote` |
| `payments` | RabbitMQ | `payment-receipts` | 1 | `recordPaymentReceipt` |
| `payments` | RabbitMQ | `payment-reviews` | 1 | `holdPaymentForReview` |
| `payments` | RabbitMQ | `payment-events-invalid` | 1 | `holdPaymentForReview` |

Both brokers are single instance. The two clean mappings take a batch of 10 and hold messages for 5
seconds before invoking.

RabbitMQ uses that: the four clean payments arrive in one invocation, in order. ActiveMQ does not.
Every run delivered its four clean orders as four invocations of one message. Raising the window to 20
seconds changed nothing. Lambda runs five consumers against an ActiveMQ mapping and one against a
RabbitMQ mapping. That is the only difference between them.

Every queue that can carry a failure takes a single message per batch instead. The messages behind a
failure are never tried. Give three failures one batch between them and only the first is reported.

Batching alone does not fix RabbitMQ, whose mapping gets that one execution environment. A failing
message holds its queue until it expires, so each RabbitMQ failure has a queue of its own. An ActiveMQ
mapping gets five, so its three failures share a queue and still run in parallel.

The ActiveMQ broker sits in a public subnet of the stack's own VPC, behind a security group. The
RabbitMQ broker has no VPC of its own. A public RabbitMQ broker takes neither a subnet nor a security
group.

## Iterating

```bash
pnpm -F @lambda-event-router/service-example-mq diff   # review pending changeset
pnpm -F @lambda-event-router/service-example-mq watch  # hotswap deploys
pnpm -F @lambda-event-router/service-example-mq synth  # render template
```

Changing a route means redeploying before the next publish. A stale worker sends messages down the
wrong path.

## Tear down

```bash
AWS_REGION=eu-west-2 pnpm -F @lambda-event-router/service-example-mq run destroy
```

That destroys the stack and then force deletes the two broker secrets. Destroying takes about six
minutes.

CloudFormation deletes a secret with a 30 day recovery window, which keeps its name taken. The purge
is what frees the name for the next deploy.

Nothing is left behind. Each broker takes its queues with it, and the stack owns every log group.
