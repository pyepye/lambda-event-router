# Service example: DynamoDB

A deployable CDK app that exercises the `DynamoDBRouter` end to end. It models an order service. One
Lambda consumes two DynamoDB streams, and the router does the per-record dispatch.

```
orders (NEW_AND_OLD_IMAGES)
├── processOrder            (insert: partitionKey ORDER#*, sortKey SUMMARY)
├── chargeCard              (insert: sortKey PAYMENT#*, throws on a declined card)
├── handleOrderStatusChange (modify: custom filter, the status moved)
├── recordOrderEdit         (modify: every other edit to a summary)
├── archiveOrder            (remove: sortKey SUMMARY)
└── syncCustomerProfile     (eventName INSERT and MODIFY, partitionKey CUSTOMER#*)

search-index (KEYS_ONLY)
└── invalidateSearchCache   (streamViewType filter, all three event names)
```

A table has several stream shards, each covering a set of partition keys. A shard delivers its records
in order, and a failing record holds that shard. The worker allows one retry, and then Lambda discards
the rest of that batch. There is no on-failure destination. Lambda only writes those to SQS or SNS, and
this example stays on one service.

Both tables use `pk` and `sk`, because the router's `keys` option names one pair for every route.

## What it covers

One `write:items` puts six groups of writes on the two tables. Together they hit every filter the
router has, all four ways of registering a route, and every failure path.

| Feature | Where |
| --- | --- |
| `eventSourceArn` filter | Every orders route matches the orders stream by ARN |
| `eventName` filter | `insert`, `modify` and `remove` set one name, `syncCustomerProfile` takes two |
| `partitionKey` filter | `processOrder` matches `ORDER#*`, `syncCustomerProfile` matches `CUSTOMER#*` |
| `sortKey` filter | `chargeCard` matches `PAYMENT#*`, four routes match `SUMMARY` |
| `streamViewType` filter | `invalidateSearchCache` matches the `KEYS_ONLY` stream, and nothing else does |
| `custom` filter | `handleOrderStatusChange` compares the old status with the new one |
| Router `keys` option | Names `pk` and `sk`, which the two key filters read |
| Zod schemas | `keysSchema` on two routes, `newImageSchema` on five, `oldImageSchema` on two |
| Unmarshalled values | `processOrder` gets `total` as a number and `tags` as a `Set` |
| Router middleware | `logChange` runs once per record, on both streams |
| Route middleware | `withOrderContext` on `processOrder` |
| Batch item failures | `createDynamoDBRouter({ batchItemFailures: true })`, both streams report them |
| No route matched | A `SUPPLIER#` item, which no partition key filter covers |
| Handler failure | `chargeCard` throws on a declined card, after its middleware has run |
| Schema failures | A payment key with no reference, an order with no total, and the deletion of that order |
| Retries | Every failing batch is attempted twice |
| Discarded records | A valid order behind the declined payment never runs |

Images are unmarshalled before any schema sees them. An `N` attribute arrives as a number and an `SS`
attribute as a `Set`, so nothing needs coercing.

Filters run before the schemas and read the raw images. That is why `handleOrderStatusChange` checks
both images are there before it compares them.

CDK injects both stream ARNs as env vars, and `src/config.ts` reads them. The `eventSourceArn` filters
match against those values.

Handlers do their work by logging, so the CloudWatch logs are how you confirm routing. The router
returns a batch response rather than anything a handler produces, so there is nothing else to assert.

## Prerequisites

- AWS account with credentials on the shell
- CDK bootstrap already run for the target account / region
- Node 24 and pnpm installed

## Permissions

`deploy-policy.json` holds the minimum permissions needed to deploy this example and test it. Attach
it to the user or role you run the commands with.

CloudFormation work is done by the CDK bootstrap roles, so the policy only allows assuming those
roles. The rest covers writing the sample items and reading the worker logs. Actions are locked down,
resources are not.

Note: the policy assumes the default bootstrap qualifier `hnb659fds`. Change the role and parameter
ARNs if your account uses a custom one.

## Deploy

From this directory:

```bash
pnpm -F @lambda-event-router/service-example-dynamodb build
pnpm -F @lambda-event-router/service-example-dynamodb run deploy
```

CDK outputs include `OrdersTableArn` and `SearchIndexTableArn`.

## Write sample items

Pass the two table ARNs from the deploy outputs:

```bash
pnpm -F @lambda-event-router/service-example-dynamodb run write:items \
  <OrdersTableArn> <SearchIndexTableArn>
```

That is 16 writes, 13 on the orders table and 3 on the search index. Five are meant to fail, and a
sixth is discarded behind one of them.

The script takes about 80 seconds, because it waits 20 seconds between groups. A failing batch holds
its shard until Lambda has retried it and given up. The wait is what puts each failure in a batch of
its own.

The first group is eight writes in a row. They arrive as several invocations rather than one, grouped
by partition key. Records sharing a key stay in the order they were written.

Every key carries a fresh run id, so all 16 writes are inserts however many times you run the script.

The script takes its region and both table names from the ARNs, so it does not need `AWS_REGION` set.

## Checking the logs

Wait about a minute after the script finishes. The last group still has a retry to get through.

Save the worker logs to a file:

```bash
aws logs tail /aws/lambda/ler-example-dynamodb-worker --since 15m --format short > worker.log
```

Widen the window with `--since`, which takes a single unit such as `30m`, `2h` or `1d`. Add `--follow`
to keep writing to the file while you write more items. The worker logs in JSON, so `--format json`
pretty prints the fields.

Note: the log group is `/aws/lambda/<stackName>-worker`, so the name changes if you deploy with a
different `stackName`.

Sixteen writes produce thirteen invocations: eight first attempts and five retries. The orders table
splits across shards by partition key, so that count moves by one or two between runs.

There is one `Handling DynamoDB record` line per record that reaches a handler, so twelve in all. A
record that matches no route, or fails a schema, never gets one. The router matches and validates
before it runs middleware.

The five order records share a partition key, so they arrive in one invocation in the order they were
written:

- `Order accepted for fulfilment` for the new order. `unmarshalledTypes` reads `total: 'number'` and
  `tags: true`.
- `Card charged` for the payment. `orderId` and `paymentRef` come from `PaymentKeysSchema`, which
  splits the key pair into the two ids it encodes.
- `Order status changed` from `placed` to `shipped`. Its custom filter is what got it here rather than
  to `recordOrderEdit`.
- `Order edited` for the note. The status did not move, so the custom filter turned it down and
  `recordOrderEdit` took it.
- `Order archived`, reading the old image. A `REMOVE` record has no new one.

Every line after the first carries `orderId`. `withOrderContext` appended it on the first record, and
an appended key lasts for the whole invocation rather than one record.

The customer profile is a different partition key, so its two records are an invocation of their own:

- `Customer profile synced` with `eventName: 'INSERT'` and `hadProfileBefore: false`.
- `Customer profile synced` again, with `eventName: 'MODIFY'` and `hadProfileBefore: true`. One route
  took both event names.

Neither of those lines carries `orderId`, because nothing in that invocation appended it.

The supplier item is a third partition key and matches nothing, so it fails on its own. It logs
`Error processing DynamoDB record <eventID>`, whose message is `No route matched`.

The search index is a second table, so its three records are an invocation of their own:

- `Search cache invalidated` appears three times, once each for `INSERT`, `MODIFY` and `REMOVE`.
- `hasImages` is `false` on all three. A `KEYS_ONLY` stream carries no images, which is what the
  `streamViewType` filter picks out.

Four more invocations follow, one per group, each holding one failing record. Each logs
`Error processing DynamoDB record <eventID>`, and the message tells them apart:

- `Image validation failed for Keys` is the payment whose sort key is `PAYMENT#` with no reference
  after it. It matches `chargeCard`'s `PAYMENT#*` filter and then fails `PaymentKeysSchema`.
- `Payment gateway declined` comes from the handler. That record has a `Handling DynamoDB record` line,
  because the handler ran.
- `Image validation failed for NewImage` is the order with no `total`.
- `Image validation failed for OldImage` is the deletion of that same order. The invalid image reaches
  `archiveOrder` as an old image instead.

The valid order written straight after the declined payment never appears. It carries that payment's
partition key, so it sat behind a failure on the same shard. Lambda discarded it rather than delivering
it again.

Each of the five failing batches is attempted twice. Lambda reuses the request id for the retry, so the
same error appears twice under one id. The records handled before a failure are not repeated. The batch
response names the failing sequence number, and Lambda retries from there.

Note: nothing is logged when Lambda gives up on a batch. The missing handler line is the evidence.

## Tables and routes

| Table | Stream | Routes |
| --- | --- | --- |
| `orders` | NEW_AND_OLD_IMAGES | `processOrder`, `chargeCard`, `handleOrderStatusChange`, `recordOrderEdit`, `archiveOrder`, `syncCustomerProfile` |
| `search-index` | KEYS_ONLY | `invalidateSearchCache` |

Both tables are on-demand and start empty. Both event sources read from `TRIM_HORIZON` and allow one
retry. Each takes up to ten records, with a two second batching window.

## Iterating

```bash
pnpm -F @lambda-event-router/service-example-dynamodb diff   # review pending changeset
pnpm -F @lambda-event-router/service-example-dynamodb watch  # hotswap deploys
pnpm -F @lambda-event-router/service-example-dynamodb synth  # render template
```

## Tear down

```bash
pnpm -F @lambda-event-router/service-example-dynamodb destroy
```

The stack owns both tables and its log group. `destroy` removes the tables, the worker, the event
source mappings and the logs. The items the script wrote go with the tables. Nothing is left behind.
