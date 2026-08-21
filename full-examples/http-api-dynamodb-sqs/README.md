# Full example: HTTP API + DynamoDB + SQS fan-out chain

A deployable CDK app that chains the API Gateway, DynamoDB and SQS routers through one order flow:

```
Client
└── API Gateway (HTTP API)
    └── apiFn / createOrder (apiRouter, POST /orders)
        └── DynamoDB PutItem on pk = ORDER
            └── workerFn / orderProcessor (dynamoDBRouter, INSERT on pk = ORDER)
                ├── SQS message: decrementStock (one per item)
                │   └── workerFn / decrementStock (sqsRouter)
                │       └── DynamoDB UpdateItem on pk = STOCK
                │           └── workerFn / stockMonitor (dynamoDBRouter, MODIFY on pk = STOCK)
                └── SQS message: sendConfirmationEmail
                    └── workerFn / sendConfirmationEmail (sqsRouter)
```

`GET /orders/:id` reads an order back through the `getOrder` route on `apiFn`.

The steps to run it are in [Prerequisites](#prerequisites), [Permissions](#permissions)
and [Deploy](#deploy).

There are 6 routes on two Lambda functions, `apiFn` and `workerFn`. Both deploy `src/index.ts`, where
one `LambdaRouter` combines all three routers. Each function receives only its own events, so the
right router picks them up.

Each router has a small middleware from `src/middleware/logInvocation.ts`. It logs one line before
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

The API routes have no authoriser, so the `curl` calls below need no AWS credentials.

Note: the policy assumes the default bootstrap qualifier `hnb659fds`. Change the role and parameter
ARNs if your account uses a custom one.

## Deploy

From this directory:

```bash
pnpm -F @lambda-event-router/full-example-http-api-dynamodb-sqs... install
pnpm -F @lambda-event-router/full-example-http-api-dynamodb-sqs... build
pnpm -F @lambda-event-router/full-example-http-api-dynamodb-sqs run deploy
```

CDK outputs include `ApiUrl`, `TableName`, `QueueUrl` and `DlqUrl`.

## Playing around

Set `API` to the `ApiUrl` output from the deploy.

```bash
export API=<ApiUrl>

# 1. Place an order for 2 of widget-a and 1 of widget-b
curl -X POST -H 'content-type: application/json' \
  -d '{"items":[{"sku":"widget-a","qty":2},{"sku":"widget-b","qty":1}]}' \
  "$API/orders"

# 2. Read the order back, using the orderId from step 1. Its status is processed.
curl "$API/orders/<orderId>"

# 3. Take widget-c from 6 to 4, which is below its threshold of 5
curl -X POST -H 'content-type: application/json' \
  -d '{"items":[{"sku":"widget-c","qty":2}]}' \
  "$API/orders"

# 4. Ask for more widget-c than there is
curl -X POST -H 'content-type: application/json' \
  -d '{"items":[{"sku":"widget-c","qty":10}]}' \
  "$API/orders"
```

## Checking the logs

Save the worker logs to a file:

```bash
aws logs tail /aws/lambda/http-api-dynamodb-sqs-worker --since 10m --format short > worker.log
```

The API function logs to its own group, `/aws/lambda/http-api-dynamodb-sqs-api`.

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
4. `stockMonitor` logs `Stock level changed` twice, once per `STOCK` row.

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

- `pk = ORDER`, `sk = <orderId>` - order rows: items, status and createdAt.
- `pk = STOCK`, `sk = <sku>` - stock rows: quantity and lowStockThreshold.

`cdk deploy` seeds three stock rows through an `AwsCustomResource`, so an order has stock to take.
Each row has a low-stock threshold of 5.

- `widget-a` (qty 100)
- `widget-b` (qty 50)
- `widget-c` (qty 6, used to show the low-stock warning)

## Iterating

```bash
pnpm -F @lambda-event-router/full-example-http-api-dynamodb-sqs diff   # review pending changeset
pnpm -F @lambda-event-router/full-example-http-api-dynamodb-sqs watch  # hotswap deploys
pnpm -F @lambda-event-router/full-example-http-api-dynamodb-sqs synth  # render template
```

## Tear down

```bash
pnpm -F @lambda-event-router/full-example-http-api-dynamodb-sqs destroy
```

This deletes the table, both queues and all the log groups.
