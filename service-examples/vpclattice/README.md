# Service example: VPC Lattice

A deployable CDK app that exercises the `VPCLatticeRouter` end to end. It models an inventory
service reached over a service network. One Lambda serves every route, and a second Lambda inside
the VPC makes the requests.

The steps to run it are in [Prerequisites](#prerequisites), [Permissions](#permissions)
and [Deploy](#deploy).

```
inventory (one Lattice service, one domain name)
├── port 80    target group on payload version 1.0
└── port 8080  target group on payload version 2.0

both listeners reach the same routes
├── GET     /stock/available                  listAvailableStock   literal beats the path param
├── GET     /stock/:sku                       getStockItem         querySchema, multi-value query
├── HEAD    /stock/:sku                       headStockItem        the router strips the body
├── OPTIONS /stock/:sku                       describeStockItem    beats the automatic preflight
├── POST    /stock                            createStockItem      bodySchema
├── PUT     /stock/:sku                       replaceStockItem     two route middlewares, binary body
├── PATCH   /stock/:sku                       adjustStockOnFloor   custom filter on x-channel
├── PATCH   /stock/:sku                       adjustStockLevel
├── DELETE  /stock/:sku                       discardStockItem
├── GET     /stock/retired/:sku               redirectRetiredSku   307 and 308
├── GET     /stock/:sku/movements/:movementId getStockMovement     two path params
├── GET     /suppliers/:supplierId/skus       listSupplierSkus     needs a caller identity
├── GET     /reports/valuation                valueStockHolding    responseSchema the handler fails
├── GET     /reports/valuation.csv            exportStockValuation a literal dot, a string body
└── POST    /reorders                         raiseReorder         throws
```

A Lattice service only resolves inside a VPC associated with its service network. The requests
come from the ordering function rather than from your shell, and the trigger prints what it
reports back.

The port is the only thing that picks the payload version. The same request list runs twice
against the same routes, so the two adapters can be compared side by side.

Note: VPC Lattice sends the query string twice, once in the query field and again appended to the
path. No other HTTP event source does that. The adapter takes it off the path before matching, so
`/stock/brk-9?page=2` reaches the route as `/stock/brk-9`.

## What it covers

One command sends every request on both listeners. Together they hit every filter the router
supports and every failure path it has.

| Feature | Where |
| --- | --- |
| Payload version 1.0 | The port 80 listener, normalised by `vpcLatticeV1Adapter` |
| Payload version 2.0 | The port 8080 listener, normalised by `vpcLatticeV2Adapter` |
| `method` filter | GET, POST, PUT, PATCH, DELETE, HEAD and OPTIONS |
| `path` filter | Path params, two params in one path, and a literal outranking a param |
| `custom` filter | `adjustStockOnFloor` reads a header the schemas never see |
| `defineRoute` | Eight routes, including the one that takes a `custom` |
| Convenience methods | `get`, `post`, `put`, `patch`, `delete`, `head` and `options`, one route each |
| `querySchema` | `getStockItem` coerces `page` to a number |
| `bodySchema` | `createStockItem`, `adjustStockLevel`, `adjustStockOnFloor` and `raiseReorder` |
| `responseSchema` | `listAvailableStock` passes its own schema, `valueStockHolding` fails its own |
| Router middleware | `logRequest` runs once per matched request |
| Route middleware | `withStockContext` logs, `requireCallerPrincipal` throws, `withStocktakeFreeze` answers without calling `next` |
| CORS | An origin function, credentials, exposed headers, an automatic preflight, and a registered `options()` route that wins |
| Multi-value query and headers | A repeated `depot` and a repeated `x-depot` on both listeners |
| Query on the path | Lattice appends the query string to the path it sends, and the adapter takes it off |
| HEAD responses | `headStockItem` builds a body and the router strips it |
| Auth | `listSupplierSkus` reads `auth.principalId`. Only a signed caller has one, on either version |
| Request context | `getStockItem` reads `serviceArn` off the event, which only a 2.0 payload carries |
| WARN records | `requireCallerPrincipal` warns before it refuses an unsigned caller |
| Binary body | `replaceStockItem` takes a count sheet as bytes, typed by a `bodySchema` of `BinaryBody` |
| String response | `exportStockValuation` returns CSV, so the router sets no JSON content type |
| Escaped path literal | `/reports/valuation.csv` matches itself, and `/reports/valuationXcsv` answers 404 |
| No route matched | An unrouted path, a preflight for an unrouted path, and a near miss on an escaped dot |
| Schema failures | One query and three bodies |
| Thrown responses | 401, 404, 409, 307 and 308, from handlers and from two middlewares |
| Handler failure | `raiseReorder` throws an error, which the router answers 500 |

The service auth type is `AWS_IAM` and its auth policy allows any caller. Lattice names a signed
caller and says nothing about an unsigned one, so the supplier read is sent both ways.

Where it names them depends on the payload version. A 2.0 payload carries
`requestContext.identity.principal` and a 1.0 payload carries the `x-amzn-lattice-identity`
header. The router reads both into `auth.principalId`, so a handler sees the same thing either
way.

Handlers do their work by logging, so the CloudWatch logs are how you confirm routing. Everything
the router answers with is asserted by the trigger.

## Prerequisites

- AWS account with credentials on the shell
- CDK bootstrap already run for the target account / region
- Node 24 and pnpm installed

## Permissions

`deploy-policy.json` holds the minimum permissions needed to deploy this example and test it.
Attach it to the user or role you run the commands with.

CloudFormation work is done by the CDK bootstrap roles, so the policy only allows assuming those
roles. The rest covers reading the stack outputs, invoking the ordering function and reading the
two Lambda log groups. Actions are locked down, resources are not.

Note: the policy assumes the default bootstrap qualifier `hnb659fds`. Change the role and
parameter ARNs if your account uses a custom one.

## Deploy

From this directory:

```bash
pnpm -F @lambda-event-router/service-example-vpclattice... install
pnpm -F @lambda-event-router/service-example-vpclattice... build
pnpm -F @lambda-event-router/service-example-vpclattice run deploy
```

CDK outputs include `LatticeDomain`, `OrderingFunctionName`, `InventoryLogGroupName` and
`OrderingLogGroupName`.

The stack creates its own VPC with a single isolated subnet. It has no NAT gateway and no
internet gateway. The ordering function only ever talks to the Lattice service.

## Send sample requests

```bash
pnpm -F @lambda-event-router/service-example-vpclattice trigger
```

The script reads the stack outputs itself, so it takes no arguments. Pass a stack name as the
first argument if you deployed with a different one.

It invokes the ordering function once. That function sends 32 requests to the 1.0 listener and
the same 32 to the 2.0 listener. Each one is asserted on its status code, and on a body or a
header. A line per step says whether it passed. Nothing it sends changes any state, so running it
twice in a row gives the same answer.

Only one step answers differently on the two listeners. The stock read repeats a query param,
and a 1.0 payload can only carry one value for it.

VPC Lattice invokes the Lambda once per request, so no invocation here holds more than one event.

Note: the domain only resolves once the VPC association is active. Run the trigger again if the
first one after a deploy cannot resolve it.

## Checking the logs

Take the epoch before you trigger, then export both log groups:

```bash
START=$(($(date +%s) * 1000))
pnpm -F @lambda-event-router/service-example-vpclattice trigger

aws logs filter-log-events --log-group-name /aws/lambda/ler-example-vpclattice-inventory \
  --start-time $START --output json > /tmp/ler-vpclattice-inventory.json
aws logs filter-log-events --log-group-name /aws/lambda/ler-example-vpclattice-ordering \
  --start-time $START --output json > /tmp/ler-vpclattice-ordering.json
```

Lines appear within a few seconds. Nothing here retries. A line missing after that is a line the
run never wrote. Read the file rather than exporting again for each question.

Note: the log groups are `/aws/lambda/<stackName>-inventory` and `/aws/lambda/<stackName>-ordering`,
so the names change if you deploy with a different `stackName`.

`Handling inventory request` is the router middleware, and there is one for every request that
reached a route. A full run has 48, half on each listener. Its `payloadVersion` field says which
adapter normalised the event.

Eight requests per listener reach the worker with no `Handling inventory request` line:

- Four fail a schema. The router validates the query and the body before it builds the middleware
  chain, and a request that fails either one gets no further.
- Three match no route, and are answered 404 before any middleware runs. One is
  `/reports/valuationXcsv`, which only matches if the dot in the CSV route is not escaped.
- One is the automatic preflight for `/reports/valuation`, which the router answers itself.

The rest of the log is one line per handler:

- `Stock item read` is where the two payload versions differ. The request repeats `depot` in the
  query and `x-depot` in the headers, and each listener collapses them differently.
- On the 2.0 listener `depots` is `['leeds', 'hull']` and `depotHeaders` is the same. The flat
  `depot` and `depotHeader` both hold `hull`, the last value.
- On the 1.0 listener `depots` is `['leeds']`, because that payload keeps the first value of a
  repeated query param and drops the rest. `depotHeaders` is `['leeds,hull']`, because it joins a
  repeated header into one string instead. The same event uses two different rules.
- `page` is the number 2 on both, since the querySchema coerces it.
- `principalId` is set on both listeners. `serviceArn` is set only on 2.0, because a 1.0 payload
  has no request context to read it from.
- `Available stock listed` appears four times per listener. One is the plain read, one scopes to a
  depot, and two are the CORS steps.
- `Supplier read authorised` and `Supplier SKUs listed` are the signed read. The unsigned one logs
  `Supplier read refused, no caller principal` at WARN from the same route middleware, and the run
  has two of those.
- `Stock count sheet replaced` carries `lines` as 3 and `isBase64Encoded` as true. Lattice base64
  encodes an octet stream body on both versions, and the router hands the bytes over as a `Buffer`.
  The sheet is three lines of text, so a body the router had not decoded would count as one.
  `bytes` is the length of the sheet the caller sent.
- `Stock replacement authorised` is the second route middleware on that request, and it runs
  after the router middleware.
- `Stock replacement frozen for the stocktake` is the first one answering on its own. It returns a
  409 rather than calling `next`, so neither the second middleware nor the handler runs.
- `Stock valuation exported` is the CSV route. The router sends the string back with no JSON
  content type, because only an object or an array gets one.
- `Stock adjusted on the warehouse floor` is the custom filter winning. `Stock adjusted` is the
  same method and path without the `x-channel` header.
- `Stock movement read` proves both path params reach the handler.
- `Stock item checked` is the HEAD route. It builds the same response as the GET route and the
  router strips the body.
- `Stock item options described` is the registered `options()` route answering a preflight itself.
- `Retired SKU redirected` and `SKU under review redirected` are the two redirects.
- `Stock item created` and `Stock item discarded` are the create and the delete.
- `Stock holding valued` is followed by an error. The total the handler returned is negative and
  its own `responseSchema` requires a positive one.

Three requests per listener match a route, log the router middleware and then log nothing else.
Each throws its response before the handler reaches its own log line. They are a SKU that is not
stocked, a SKU that is already stocked, and a SKU that still holds units.

The run has four `ERROR` records, two per listener. Both are the router reporting a handler it had
already run:

- `Handler response failed its responseSchema` carries the issues the valuation schema raised.
- `Unhandled error processing HTTP request` carries `Supplier ordering is unavailable for brk-9`.
  That is the error `raiseReorder` threw, and the router put its message in the 500 body.

The ordering log holds one line, `Inventory calls finished`, with `requests` 64 and `failures` 0.
The per-step results come back in the invoke response, which is what the trigger prints.

## Services and routes

| Resource | What it does |
| --- | --- |
| `ServiceNetwork` | Holds the service and the VPC association. Auth type `NONE` |
| `InventoryService` | One service, auth type `AWS_IAM`, with an auth policy that allows any caller |
| `InventoryV1TargetGroup` | `LambdaEventStructureVersion` `V1`, reached on port 80 |
| `InventoryV2TargetGroup` | `LambdaEventStructureVersion` `V2`, reached on port 8080 |
| `OrderingFn` | The caller, in the isolated subnet, signing every request as `vpc-lattice-svcs` |

Both target groups point at the same Lambda, so one route table serves both payload versions.
Neither listener has a rule, so every path reaches the worker and the router answers the 404s.

## Iterating

```bash
pnpm -F @lambda-event-router/service-example-vpclattice check   # route the request list in process
pnpm -F @lambda-event-router/service-example-vpclattice diff    # review pending changeset
pnpm -F @lambda-event-router/service-example-vpclattice watch   # hotswap deploys
pnpm -F @lambda-event-router/service-example-vpclattice synth   # render template
```

`check` drives the router with a synthetic event for every step. It catches a filter that can
never match without waiting for a deploy.

## Tear down

```bash
pnpm -F @lambda-event-router/service-example-vpclattice destroy
```

The stack owns every resource it creates, including the VPC and both log groups. Nothing is left
behind.

A Lattice service and its VPC association are billed by the hour. Destroy the stack once you have
read the logs.
