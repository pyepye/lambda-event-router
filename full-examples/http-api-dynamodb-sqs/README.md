# Full example: HTTP API + DynamoDB + SQS fan-out chain

A deployable CDK app that exercises every router in the library through a longer, realistic fan-out flow:

```
Client
└── API Gateway (HTTP API)
    └── apiFn (apiRouter)
        └── DynamoDB table (NEW_AND_OLD_IMAGES stream)
            └── workerFn / orderProcessor (dynamoDBRouter, INSERT on ORDER#*)
                ├── SQS message: decrementStock
                │   └── workerFn / decrementStock (sqsRouter)
                │       └── DynamoDB UpdateItem on STOCK#<sku>
                │           └── workerFn / stockMonitor (dynamoDBRouter, MODIFY on STOCK#*)
                └── SQS message: sendConfirmationEmail
                    └── workerFn / sendConfirmationEmail (sqsRouter)
```

Five distinct router-handled boxes (createOrder, orderProcessor, decrementStock, sendConfirmationEmail, stockMonitor) running on two Lambda functions (`apiFn` and `workerFn`). A future PR will register a global `LambdaRouter` middleware to observe all of these from a single attachment point - that is the reason this example is deliberately long.

It also has tracing middleware configured as an example to show how it can be used.

## Prerequisites

- AWS account with credentials on the shell
- CDK bootstrap already run for the target account / region
- Node 22 and pnpm installed

## Deploy

From this directory:

```bash
pnpm -F @lambda-event-router/full-example-http-api-dynamodb-sqs build
pnpm -F @lambda-event-router/full-example-http-api-dynamodb-sqs run deploy
```

CDK outputs include `ApiUrl`, `TableName`, `QueueUrl` and `DlqUrl`.

## Playing around

```bash
export API=https://m5mirjscuf.execute-api.eu-west-2.amazonaws.com

# Place an order touching two SKUs - 2 of widget-a and 1 of widget-b
curl -X POST -H 'content-type: application/json' \
  -d '{"items":[{"sku":"widget-a","qty":2},{"sku":"widget-b","qty":1},{"sku":"widget-c","qty":1}]}' \
  "$API/orders"

# Read the order back (use the orderId returned by the POST above)
curl -X GET "$API/orders/<orderId>"

# Trigger the low-stock warning - widget-c has qty 1
curl -X POST -H 'content-type: application/json' \
  -d '{"items":[{"sku":"widget-c","qty":1}]}' \
  "$API/orders"
```

## What to look for in the logs

Tail CloudWatch logs for `WorkerFn`. For the first POST you should see, in order:

1. `orderProcessor` - one log line, `decrementCount: 2, confirmationCount: 1`.
2. `decrementStock` x2 - one per SKU, with the resulting quantity.
3. `sendConfirmationEmail` x1 - the order id and item count.
4. `stockMonitor` x2 - one per modified `STOCK#` row.

For the third POST you also get a `Low stock` warning from `stockMonitor` because `widget-c` drops to zero.


## Database

Single DynamoDB table partitioned by entity prefix:

- `pk = ORDER`, `sk = <orderId>` - order rows: items list, status, createdAt
- `pk = STOCK`, `sk = <sku>` - stock rows: quantity, lowStockThreshold

`cdk deploy` seeds three stock rows via an `AwsCustomResource` so an order can immediately decrement something:

- `widget-a` (qty 100)
- `widget-b` (qty 50)
- `widget-c` (qty 6, used to demonstrate the low-stock warning)


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
