# Service example: DocumentDB

A deployable CDK app that exercises the `DocumentDBRouter` end to end. It models an online shop. One
Lambda consumes seven change streams from one Amazon DocumentDB cluster, and the router does the
per-change dispatch.

```
storefront            one mapping for the whole database, UpdateLookup
├── orders
│   ├── escalateHighValueOrder  (custom filter: total >= 500)
│   ├── createOrder             (insert, route middleware)
│   ├── applyOrderDiscount      (update, declares updateLookup)
│   ├── replaceOrder            (replace)
│   └── archiveOrder            (delete)
└── invoices
    └── recordInvoice           (insert and replace)

catalogue             one mapping for products, Default
├── indexProduct                (insert)
└── reindexProduct              (update, arrives with no document)

fulfilment            one mapping per collection, one failure each
├── payments          capturePayment throws
├── shipments         no carrier, so the fullDocument schema fails
├── stockLevels       a string _id, so the documentKey schema fails
├── priceHistory      recordPriceChange, then comparePriceChange fails on the before image
└── carrierWebhooks   no route matches
```

A DocumentDB source has no dead letter destination and no partial batch responses. A change that
throws takes its whole batch with it, and the batch is attempted six times before the stream moves
past it. The first failure in a batch therefore blocks every change behind it.

That is why each failing collection gets a mapping of its own. Give them one mapping between them
and only the first failure is ever seen.

## What it covers

One `seed` run writes 18 changes across eight collections. Together they hit every filter the router
reads, every schema it validates and every way it can fail.

| Feature | Where |
| --- | --- |
| `custom` filter | `escalateHighValueOrder` catches a large order before `createOrder` |
| `operationType` filter | The four convenience methods, plus `['insert', 'replace']` on `recordInvoice` |
| `database` filter | Three databases are in play and every route names one |
| `collection` filter | `orders` and `invoices` share one mapping, so the filter is what splits them |
| `eventSourceArn` filter | Every route matches the cluster ARN |
| `fullDocument` declaration | `applyOrderDiscount` declares `updateLookup`, so its document is typed as present |
| `fullDocumentBeforeChange` declaration | `comparePriceChange` declares `whenAvailable`, which Lambda cannot deliver |
| Zod schemas | `documentKeySchema` on every route, `fullDocumentSchema` on most, `fullDocumentBeforeChangeSchema` on `comparePriceChange` |
| Coerced values | `total` is stored as a string, so the handler receives a number |
| Extended JSON | An `_id` arrives as `{ $oid: '...' }`, which is what the document key schema matches |
| Router middleware | `logChange` runs once per change |
| Route middleware | `withOrderContext` on `createOrder` |
| Ordered batch | Eight storefront changes reach one invocation in the order they were written |
| No route matched | A carrier webhook |
| Handler failure | `capturePayment` throws after its middleware has run |
| Schema failures | A missing `carrier`, a string `_id`, and a before image that never arrives |
| Retried batch | Each failing batch is attempted six times before the stream moves on |

CDK injects the cluster ARN as an env var, and `src/config.ts` reads it. The `eventSourceArn` filters
match against that value.

Handlers do their work by logging, so the CloudWatch logs are how you confirm routing.

## Prerequisites

- AWS account with credentials on the shell
- CDK bootstrap already run for the target account / region
- Node 24 and pnpm installed

The cluster is a single `db.t3.medium` instance and the VPC has one NAT gateway. Together they cost
roughly $0.15 an hour, so tear the stack down when you are done.

## Permissions

`deploy-policy.json` holds the minimum permissions needed to deploy this example and test it. Attach
it to the user or role you run the commands with.

CloudFormation work is done by the CDK bootstrap roles, so the policy only allows assuming those
roles. The rest covers invoking the seed function, reading the worker logs and purging the cluster
secret. Actions are locked down, resources are not.

The change stream poller runs under the worker's execution role rather than a role of its own. The
stack grants that role the `rds`, `ec2`, `kms` and Secrets Manager permissions Lambda needs to reach
the cluster.

Note: the policy assumes the default bootstrap qualifier `hnb659fds`. Change the role and parameter
ARNs if your account uses a custom one.

## Deploy

From this directory:

```bash
pnpm -F @lambda-event-router/service-example-documentdb build
AWS_REGION=eu-west-2 pnpm -F @lambda-event-router/service-example-documentdb run deploy
```

CDK outputs include `SeedFunctionName`, `WorkerLogGroupName` and `ClusterArn`.

Deploying takes about eight minutes, most of it the cluster. Turning change streams on needs a mongo
admin command that no CloudFormation resource can send, so a custom resource does it once the cluster
is up. The mappings are created after that.

A rule covers one database or one collection, and a mapping is only accepted by a rule of its own
scope. The custom resource writes one rule per mapping for that reason. A database wide rule leaves
a collection scoped mapping reporting `modifyChangeStreams has not been run`.

Note: Lambda checks that rule when the mapping is created and never again. A mapping created before
its rule exists stays broken until it is replaced, and replacing it means destroying the stack.

The starting position is `LATEST`, so a change written before a mapping starts reading is never
delivered. The seed command waits for all seven mappings before it writes anything.

## Write sample documents

Pass the seed function name from the deploy outputs:

```bash
AWS_REGION=eu-west-2 pnpm -F @lambda-event-router/service-example-documentdb seed <SeedFunctionName>
```

DocumentDB has no public endpoint, so the writes come from a Lambda inside the VPC rather than from
your shell. One invocation writes all 18 changes and prints the run id it tagged them with.

Eleven of those changes are meant to succeed and five are meant to fail. Two more sit behind the
failing payment and never run.

The command first waits for every mapping to report that it is reading. A mapping takes about a
minute after the deploy to get there.

Each group is written in one go, so its mapping batches the group into a single invocation. Ordering
and a failure taking out the changes behind it only show up when several changes reach one
invocation.

Running it again works with no teardown. Every document gets a fresh id, and the run id keeps the
stock level key from colliding. Every mapping picks the next run up, because a failing batch is
dropped once its six attempts are spent.

## Checking the logs

Wait about a minute after the seed run, then save the worker logs to a file:

```bash
aws logs tail /aws/lambda/ler-example-documentdb-worker --since 15m --format short > /tmp/documentdb-worker.log
aws logs filter-log-events --log-group-name /aws/lambda/ler-example-documentdb-worker \
  --start-time $(($(date +%s) - 900))000 > /tmp/documentdb-worker.json
```

The first command is the one to read. The second returns real JSON with a `logStreamName` on every
event, which is what you want when you are counting.

Widen the window with `--since`, which takes a single unit such as `30m`, `2h` or `1d`. The worker
logs in JSON, so `--format json` pretty prints the fields.

Note: the log group is `/aws/lambda/<stackName>-worker`, so the name changes if you deploy with a
different `stackName`.

There is one `Handling change` line per change that reached a handler. It carries the operation type,
the database, the collection and the raw document key.

The storefront mapping delivers eight changes to one invocation, in the order they were written:

- `Order created` for the first order. `total` is the number 129.5, not the string that was stored.
  `deliveredDocument` is the untouched change event document, which is where you can see the
  extended JSON DocumentDB sends.
- `Order change received` sits between the `Handling change` line and `Order created`. That is the
  route middleware, and it appears on no other change.
- `High value order escalated` for the second order. It matches `createOrder` as well, and the
  custom filter is registered first. This change has no route middleware line, because that route
  carries none.
- `Order discount applied` lists `total` and `status` as updated and `itemCount` as removed. The
  mapping runs on `UpdateLookup`, which is why the handler has a document at all. Its `status` reads
  `confirmed` rather than the `discounted` the update set, because `UpdateLookup` reads the document
  when the change is polled and the replace had already landed.
- `Order replaced` shows the order at `confirmed`.
- `Order created` again for the withdrawn order, then `Order archived` for the delete that follows
  it. An archive carries the id and nothing else, because a delete has no document.
- `Invoice recorded` appears twice, once with an `operationType` of `insert` and once with
  `replace`. One route serves both, and the collection filter is what kept them out of the order
  routes.

Note: `UpdateLookup` finds nothing when the document is already gone. An order the run deletes fails
every update behind it on the `fullDocument` schema, which is why the delete gets an order of its
own.

The catalogue mapping runs on `Default` instead:

- `Product indexed` for the insert. An insert carries its document whatever the setting.
- `Product reindexed` reports `hasFullDocument` as false. On `Default` an update carries the changed
  field names and no document. A route that reads a document has to be filtered to the operations
  that carry one.

The five fulfilment mappings each fail:

- `Payment gateway unavailable for ORD-<runId>-1` is the handler throwing. That change has a
  `Handling change` line, because the middleware ran before the handler did. The other two payments
  in the batch have no lines at all. The first throw ends the invocation.
- `Schema validation failed on fullDocument` is the shipment with no `carrier`.
- `Schema validation failed on documentKey` is the stock level. Its `_id` is a SKU string, so the
  delivered document key is `{"_id":"WOOL-<runId>"}` rather than an `$oid`.
- `Price recorded` then `Schema validation failed on fullDocumentBeforeChange` is the price history
  pair. A Lambda mapping configures `fullDocument` and nothing else. A change stream it opens never
  carries a before image, so that route fails every update it takes.
- `No route matched for record ... from arn:aws:rds:...` is the carrier webhook.

Note: no change that failed validation has a `Handling change` line. The router validates before it
runs middleware.

Each of those five errors appears six times. The mapping replays the batch it could not finish, so
`Price recorded` comes back on every attempt as well. A change that succeeded ahead of a failure is
redelivered with it.

Note: the `platform.report` line reports a `status` of `success` even when the handler threw, and it
carries no error field at all. Count the `ERROR` records instead, which have `errorType`,
`errorMessage` and a `stackTrace`.

## Collections and routes

| Database | Collection | Mapping | Routes |
| --- | --- | --- | --- |
| `storefront` | `orders` | database wide, `UpdateLookup` | `escalateHighValueOrder`, `createOrder`, `applyOrderDiscount`, `replaceOrder`, `archiveOrder` |
| `storefront` | `invoices` | the same one | `recordInvoice` |
| `catalogue` | `products` | per collection, `Default` | `indexProduct`, `reindexProduct` |
| `fulfilment` | `payments` | per collection | `capturePayment` |
| `fulfilment` | `shipments` | per collection | `dispatchShipment` |
| `fulfilment` | `stockLevels` | per collection | `adjustStockLevel` |
| `fulfilment` | `priceHistory` | per collection | `recordPriceChange`, `comparePriceChange` |
| `fulfilment` | `carrierWebhooks` | per collection | none |

Every mapping reads with a batch size of 100 and a five second batching window. That is what puts a
whole seed group into one invocation.

The cluster runs with `change_stream_log_retention_duration` at 3600 seconds, the shortest it allows.
That keeps the change stream log small.

`fullDocument` and `fullDocumentBeforeChange` are the two filters the router never matches on. They
declare how the change stream was opened. What they do is make those fields non-optional in an
inferred handler. `applyOrderDiscount` and `comparePriceChange` are the routes that set them.

Money is stored as a string and read through `z.coerce.number()`. An object id arrives as
`{ $oid: '...' }` and a date as `{ $date: '...' }`. A plain number arrives as a plain number. Check
what a change event actually carries before writing a schema against it.

## Iterating

```bash
pnpm -F @lambda-event-router/service-example-documentdb diff   # review pending changeset
pnpm -F @lambda-event-router/service-example-documentdb watch  # hotswap deploys
pnpm -F @lambda-event-router/service-example-documentdb synth  # render template
```

A code change needs a redeploy before the next seed run. A stale worker sends changes down the wrong
route, which is worse than not testing them.

## Tear down

```bash
AWS_REGION=eu-west-2 pnpm -F @lambda-event-router/service-example-documentdb run destroy
```

That destroys the stack and then force deletes the cluster secret. Destroying takes between eight
and twenty two minutes. A stack whose pollers have been reading takes the longer time, because their
network interfaces hold up the subnets.

CloudFormation deletes a secret with a 30 day recovery window, which keeps its name taken. The purge
is what frees the name for the next deploy.

Note: the change streams provider log group sometimes outlives the stack. Its lambda runs while the
stack is coming down and writes a line after CloudFormation has deleted the group, which creates it
again. Delete `/aws/lambda/<stackName>-change-streams-provider` by hand if it is still there.
