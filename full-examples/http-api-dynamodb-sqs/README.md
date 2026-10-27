# Full example: HTTP API + DynamoDB + SQS fan-out chain

A deployable CDK app that chains the API Gateway, DynamoDB and SQS matchers through one order flow:

```
Client
└── API Gateway (HTTP API)
    ├── apiFn / authoriseCustomer (authorizerMatcher, before POST /orders)
    └── apiFn / createOrder (apiMatcher, POST /orders)
        └── DynamoDB PutItem on ORDER#<orderId>
            └── workerFn / orderProcessor (dynamoDBMatcher, INSERT on ORDER#*)
                ├── SQS message: decrementStock (one per item)
                │   └── workerFn / decrementStock (sqsMatcher)
                │       └── DynamoDB UpdateItem on STOCK#<sku>
                │           └── workerFn / stockMonitor (dynamoDBMatcher, MODIFY on STOCK#*)
                └── SQS message: sendConfirmationEmail
                    └── workerFn / sendConfirmationEmail (sqsMatcher)
```

`GET /orders/:id` reads an order back through the `getOrder` route on `apiFn`.

The steps to run it are in [Prerequisites](#prerequisites), [Permissions](#permissions)
and [Deploy](#deploy).

There are 7 routes on two Lambda functions, `apiFn` and `workerFn`. Both deploy `src/index.ts`, where
one `Latcher` combines all four matchers. Each function receives only its own events, so the
right matcher picks them up.

Each matcher has a small middleware from `src/middleware/logInvocation.ts`. It logs one line before
every route runs.

## Prerequisites

- AWS account with credentials on the shell
- CDK bootstrap already run for the target account / region
- Node 24 and pnpm installed

## Permissions

`deploy-policy.json` holds the minimum permissions needed to deploy this example and test it. Attach
it to the user or role you run the commands with.

CloudFormation work is done by the CDK bootstrap roles, so the policy only allows assuming those
roles. The rest covers reading the table, sending to the queue and reading the logs.
Actions are locked down, resources are not.

The `curl` calls below need no AWS credentials. See [Auth](#auth) for the token `POST /orders` takes.

Note: the policy assumes the default bootstrap qualifier `hnb659fds`. Change the role and parameter
ARNs if your account uses a custom one.

## Deploy

From this directory:

```bash
pnpm -F @latcher/full-example-http-api-dynamodb-sqs... install
pnpm -F @latcher/full-example-http-api-dynamodb-sqs... build
pnpm -F @latcher/full-example-http-api-dynamodb-sqs run deploy
```

CDK outputs include `ApiUrl`, `TableName`, `QueueUrl` and `DlqUrl`.

## Auth

`POST /orders` sits behind a Lambda authorizer, and `GET /orders/:id` has none. The authorizer runs on
`apiFn`, where `authorizerMatcher` answers it. It accepts the token `demo-token` in the `authorization`
header and passes on `{ customerId: 'cust-demo' }` as its context.

`createOrder` uses the `customerAuth` preset from `src/utils/auth.ts`. It checks the context against a
schema, so the handler reads `request.auth.context.customerId` as a string.

**The fixed token is only there so `curl` works. A real authorizer verifies a token nobody can guess.**

## Playing around

Set `API` to the `ApiUrl` output from the deploy.

```bash
export API=<ApiUrl>

# 1. Place an order for 2 of widget-a and 1 of widget-b
curl -X POST -H 'content-type: application/json' -H 'authorization: demo-token' \
  -d '{"items":[{"sku":"widget-a","qty":2},{"sku":"widget-b","qty":1}]}' \
  "$API/orders"

# 2. Read the order back, using the orderId from step 1. Its status is processed.
curl "$API/orders/<orderId>"

# 3. Take widget-c from 6 to 4, which is below its threshold of 5
curl -X POST -H 'content-type: application/json' -H 'authorization: demo-token' \
  -d '{"items":[{"sku":"widget-c","qty":2}]}' \
  "$API/orders"

# 4. Ask for more widget-c than there is
curl -X POST -H 'content-type: application/json' -H 'authorization: demo-token' \
  -d '{"items":[{"sku":"widget-c","qty":10}]}' \
  "$API/orders"

# 5. Place an order with the wrong token. API Gateway answers 403 and the order is not placed
curl -X POST -H 'content-type: application/json' -H 'authorization: wrong-token' \
  -d '{"items":[{"sku":"widget-a","qty":1}]}' \
  "$API/orders"
```

Note: after a fresh deploy, the first order can take about 30 seconds to reach `processed`.
Until then step 2 shows `pending`.

## Checking the logs

Save the worker logs to a file:

```bash
aws logs tail /aws/lambda/http-api-dynamodb-sqs-worker --since 10m --format short > worker.log
```

The API function logs to its own group, `/aws/lambda/http-api-dynamodb-sqs-api`. For step 1 it logs
`Handling authorizer request` from the authorizer, then `Order created` with `customerId` set to `cust-demo`.

Widen the window with `--since`, which takes a single unit such as `30m`, `2h` or `1d`. Add
`--follow` to keep writing to the file while you send more requests. Both functions log in JSON, so
`--format json` pretty prints the fields.

Note: the group names are `/aws/lambda/<stackName>-worker` and `/aws/lambda/<stackName>-api`, so they
change if you deploy with a different `stackName`.

Each route's log line comes after a `Handling ...` line from the middleware. For step 1 you see, in
order:

1. `orderProcessor` logs `Order processed` with `messageCount: 3`.
2. `decrementStock` logs `Stock decremented` twice, once per SKU.
3. `sendConfirmationEmail` logs `Confirmation email dispatched` once.
4. `stockMonitor` logs `Stock level changed` twice, once per stock row.

The `decrementStock` and `sendConfirmationEmail` lines can interleave, because they come from the same SQS
batch.

Step 3 also logs a `Low stock` warning from `stockMonitor`. The warning fires only when the quantity
goes from above the threshold to at or below it.

Step 4 logs `Not enough stock` from `decrementStock`. The stock does not change, so `stockMonitor`
does not run, and the message is not retried.

Note: the messages have no idempotency key. If `orderProcessor` fails after it sends some messages, the
retry sends them all again and takes the stock twice.

## Database

Single DynamoDB table partitioned by entity prefix:

- `pk = ORDER#<orderId>`, `sk = ORDER` - order rows: items, status and createdAt.
- `pk = STOCK#<sku>`, `sk = STOCK` - stock rows: quantity and lowStockThreshold.

`cdk deploy` seeds three stock rows through an `AwsCustomResource`, so an order has stock to take.
Each row has a low-stock threshold of 5.

- `widget-a` (qty 100)
- `widget-b` (qty 50)
- `widget-c` (qty 6, used to show the low-stock warning)

## Iterating

```bash
pnpm -F @latcher/full-example-http-api-dynamodb-sqs diff   # review pending changeset
pnpm -F @latcher/full-example-http-api-dynamodb-sqs watch  # hotswap deploys
pnpm -F @latcher/full-example-http-api-dynamodb-sqs synth  # render template
```

## Tear down

```bash
pnpm -F @latcher/full-example-http-api-dynamodb-sqs destroy
```

This deletes the table, both queues and all the log groups.
