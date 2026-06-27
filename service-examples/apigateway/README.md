# Service example: API Gateway

A deployable CDK app that exercises the `APIGatewayRouter`, `LambdaAuthorizerRouter` and
`WebSocketRouter` end to end. It models a warehouse fulfilment service across three APIs, and every
route belongs to one of the three routers.

One worker Lambda serves all three APIs. A second Lambda authorises the REST API and the HTTP API.

```
orders (REST API, payload format 1.0)
├── GET     /orders/pending                listPendingOrders     literal beats the path param
├── GET     /orders/:orderId               getOrder              REQUEST authorizer
├── POST    /orders                        createOrder           TOKEN authorizer
├── PATCH   /orders/:orderId               amendOrderOnFloor     custom filter on x-channel
├── PATCH   /orders/:orderId               amendOrder
├── GET     /orders/:orderId/lines/:lineId getOrderLine
├── PUT     /orders/:orderId/manifest      uploadOrderManifest   base64 encoded body
├── DELETE  /orders/:orderId               no authorizer route matches
└── GET     /warehouse/stock               getStockLevel         API key

fulfilment (HTTP API, payload format 1.0 on /dispatch)
├── GET     /dispatch/quote                quoteCarrierRate      responseSchema
├── GET     /dispatch/:consignmentId       getConsignment
├── GET     /dispatch/:consignmentId/label getConsignmentLabel
└── POST    /dispatch                      bookConsignment       route middleware

fulfilment (HTTP API, payload format 2.0 on everything else)
├── GET     /inventory/:sku                getStockRecord
├── GET     /inventory/:sku/audit          getStockAudit         IAM authorizer
├── HEAD    /inventory/:sku                headStockRecord
├── OPTIONS /inventory/:sku                describeStockOptions
├── PUT     /inventory/:sku                adjustStock           simple-response authorizer
├── PATCH   /inventory/:sku                reconcileStock        policy-mode authorizer
├── DELETE  /inventory/:sku                discardStockRecord
└── GET     /inventory/retired/:sku        redirectRetiredSku

alerts (WebSocket API)
├── $connect                               openAlertStream
├── $disconnect                            closeAlertStream
├── sendAlert                              broadcastAlert
├── admin*                                 runAdminCommand       custom filter on the route key
├── $default                               rejectUnknownAction
└── subscribe                              no router route matches
```

## What it covers

One command sends every request. Together they hit every filter the three routers support and every
failure path each router has. They also cover all three payload formats API Gateway can send.

| Feature | Where |
| --- | --- |
| REST API payload | The `orders` API, normalised by `apiGatewayV1Adapter` |
| HTTP API payload 1.0 | The `/dispatch` routes, normalised by the same V1 adapter |
| HTTP API payload 2.0 | Every other `fulfilment` route, normalised by `apiGatewayV2Adapter` |
| `method` filter on a route | GET, POST, PUT, PATCH, DELETE, HEAD and OPTIONS |
| `path` filter | Path params, two params in one path, and a literal outranking a param |
| `custom` filter on a route | `amendOrderOnFloor` reads a header the schemas never see |
| `defineRoute` | Thirteen routes, including every route that takes a `custom` |
| Convenience methods | `get`, `post`, `put`, `patch`, `delete`, `head` and `options`, one route each |
| `querySchema` | `getOrder` coerces `page` to a number |
| `bodySchema` | `createOrder`, `amendOrder`, `bookConsignment`, `adjustStock`, `reconcileStock` |
| `responseSchema` | `quoteCarrierRate` returns a price its own schema rejects |
| Router middleware | `logRequest`, `logSocketEvent` and `logAuthorizerAttempt`, one per router |
| Route middleware | `withOrderContext` logs, `requireDispatchRole` throws, `withAuditTrail` reads the result |
| CORS | An origin function, credentials, exposed headers, an automatic preflight, and a registered `options()` route that wins |
| Multi-value headers and query | A repeated query param on all three payload formats, and a repeated header on both adapters |
| HEAD responses | `headStockRecord` builds a body and the router strips it |
| Auth from a TOKEN authorizer | `createOrder` reads `auth.principalId` and `auth.context` |
| Auth from a REQUEST authorizer | `getOrder` reads the principal the policy named. `generatePolicy` attaches no context, so `auth.context` is empty |
| Auth from an HTTP API authorizer | `reconcileStock` reads `auth.context.lambda` |
| Auth from an API key | `getStockLevel` reads `auth.apiKeyId` |
| Auth from IAM | `getStockAudit` reads `auth.iam` off a SigV4 signed request |
| Base64 encoded body | `uploadOrderManifest` reads a manifest the router decoded |
| `type` filter | `token()` and `request()` split the authorizer's two event types |
| `method` filter on an authorizer route | PUT and PATCH are routed separately from the read route |
| `custom` filter on an authorizer route | The read route covers GET and HEAD in one filter |
| Authorizer responses | `Allow`, `Allow` with a context, `Deny`, a thrown `Deny`, `generatePolicy`, a boolean |
| `eventType` filter | `connect()`, `disconnect()` and `message()` |
| `routeKey` filter | `sendAlert` and `$default` |
| `custom` filter on a WebSocket route | `runAdminCommand` matches any route key with the `admin` prefix |
| `postToConnection` | Three WebSocket handlers answer over the connection |
| No route matched | An unrouted path, an unrouted authorizer method, an unrouted WebSocket route key |
| Schema failures | A query, three bodies and a WebSocket frame |
| Thrown responses | 401, 403, 404, 409, 307 and 308, from handlers and from a middleware |
| Handler failure | `bookConsignment` throws an error, which the router answers 500 |

Handlers do their work by logging, so the CloudWatch logs are how you confirm routing. Everything
the routers answer with is asserted by the trigger.

## Prerequisites

- AWS account with credentials on the shell
- CDK bootstrap already run for the target account / region
- Node 24 and pnpm installed

## Permissions

`deploy-policy.json` holds the minimum permissions needed to deploy this example and test it. Attach
it to the user or role you run the commands with.

CloudFormation work is done by the CDK bootstrap roles, so the policy only allows assuming those
roles. The rest covers reading the stack outputs, reading the API key value and reading the two
Lambda log groups. Most of the requests are plain HTTPS calls that need no permission, and the
exception is the IAM authorized audit route, which needs `execute-api:Invoke`.

Note: the policy assumes the default bootstrap qualifier `hnb659fds`. Change the role and parameter
ARNs if your account uses a custom one.

## Deploy

From this directory:

```bash
pnpm -F @lambda-event-router/service-example-apigateway build
pnpm -F @lambda-event-router/service-example-apigateway run deploy
```

CDK outputs include `RestApiUrl`, `HttpApiUrl`, `WebSocketUrl`, `StockApiKeyId`,
`WorkerLogGroupName` and `AuthorizerLogGroupName`.

The four Lambda authorizers cache a decision for five minutes by default. Every one is deployed with
a TTL of zero. A second run of the trigger reaches the authorizer Lambda rather than a cached policy.

Note: a new API key takes about a minute to start working. Wait that long after the first deploy of
the stack, or the stock levels step answers 403.

## Send sample requests

```bash
pnpm -F @lambda-event-router/service-example-apigateway trigger
```

The script reads the stack outputs itself, so it takes no arguments. Pass a stack name as the first
argument if you deployed with a different one.

It sends 44 requests and opens 3 WebSocket connections. Each one is asserted on its status code, and
on a body or a header. A line per step says whether it passed. Nothing it sends changes any state, so
running it twice in a row gives the same answer.

Nine of the requests never reach the worker. An authorizer denies them, an authorizer fails, or API
Gateway rejects them itself for a missing API key or an unsigned request.

Note: the two requests that repeat a header go through `node:https` rather than `fetch`. `fetch`
folds a repeated header name into one comma-joined value, which hides the difference between the two
adapters.

API Gateway invokes the Lambda once per request, so no invocation here holds more than one event.

## Checking the logs

Save both log groups to one file:

```bash
aws logs tail /aws/lambda/ler-example-apigateway-worker --since 10m --format short > /tmp/ler-apigateway.log
aws logs tail /aws/lambda/ler-example-apigateway-authorizer --since 10m --format short >> /tmp/ler-apigateway.log
```

Lines appear within a few seconds. Nothing here retries, so a line that is missing after that is a
line the run never wrote.

Note: the log groups are `/aws/lambda/<stackName>-worker` and `/aws/lambda/<stackName>-authorizer`,
so the names change if you deploy with a different `stackName`.

### The worker log

`Handling API request` is the router middleware, and there is one for every request that reached a
route. A full run has 28. Its `payloadVersion` field says which adapter normalised the event: `rest`
for the REST API, `1.0` for the `/dispatch` routes and `2.0` for the rest of the HTTP API.

Two `ERROR` records are the router reporting a handler that had already run:

- `Handler response failed its responseSchema` follows `Carrier quote fetched`. The handler returned
  a price of -1 and its own schema requires a positive one.
- `Unhandled error processing HTTP request` carries `Carrier palletline rejected the booking`. That
  is the error the handler threw, and the router put its message in the 500 body.

Seven requests reach the worker with no `Handling API request` line:

- The two automatic preflights and the request to `/nowhere` match no route, and are answered before
  any middleware runs.
- The four schema failures do match a route. The router validates the query and the body before it
  builds the middleware chain, and a request that fails either one gets no further.

The rest of the log is one line per handler:

- `Order read authorised` is the route middleware, and it names the principal the REQUEST authorizer
  allowed. There is one for `ord-1042` and one for `ord-9999`.
- `Order read` carries `page` as the number 2 and `tags` as `['urgent', 'fragile']`. Its
  `authorizerContext` is `{}`, because `generatePolicy` returns a policy with no context on it. It
  is absent for `ord-9999`, where the handler throws `NotFound` before logging.
- `Pending orders listed` proves `/orders/pending` is reached despite being registered after
  `/orders/:orderId`.
- `Order created` carries the TOKEN authorizer's context. API Gateway sends every context value on
  as a string, so `clearance` arrives as `"3"` rather than 3.
- `Order amended on the warehouse floor` is the custom filter winning. `Order amended` is the same
  method and path without the `x-channel` header.
- `Order line read` proves both path params reach the handler.
- `Order manifest uploaded` carries `lines` as 3 and `isBase64Encoded` as true. The manifest is three
  lines of text, so a body the router had not decoded would count as one.
- `Stock levels read` carries the API key's id. The key value is a credential, so the handler logs
  only whether it is there.
- `Consignment read` carries `depots` and `depotHeaders` both as `['leeds', 'hull']`. Payload format
  1.0 sends the multi-value form of the query and the headers, so the two values survive.
- `Stock record read` carries `depot` and `depotHeader` as `'leeds,hull'`, and `depots` and
  `depotHeaders` as `['leeds,hull']`. Payload format 2.0 has no multi-value form. API Gateway joins
  the repeats before the Lambda sees them, and the router does not split them back apart.
- `Stock audit read` carries the `accountId` and `userArn` API Gateway resolved the signature to.
- `Stock record checked` is the HEAD route. It builds the same response as the GET route and the
  router strips the body.
- `Stock options described` is the registered `options()` route answering a preflight itself.
- `Stock adjusted` carries `auth` as `{ context: { lambda: null } }`. The simple-response authorizer
  answers with a boolean, so API Gateway sends a context whose `lambda` field is null.
- `Stock reconciled` carries `authorizerContext.lambda` with `costCentre` and `shift`. An HTTP API
  nests a policy-mode authorizer's context under `lambda`.
- `Stock record discarded` is the SKU with no units left. The SKU that still holds stock throws
  `Conflict` and logs nothing.
- `Retired SKU redirected` and `Label redirect issued` are the two redirects.

`Handling WebSocket event` opens the WebSocket half of the log. There is one for every connect,
message and disconnect that matched a route and passed its schema. A full run has 7:

- `Alert stream opened`, `Alert stream refused, no token` and `Alert stream refused, retired token`
  are the three handshakes. The last one throws its response rather than returning it, and both
  refusals reach the client as the handshake status.
- `Stock alert received` is the route middleware, which sees the alert already validated.
- `Stock alert broadcast` is followed by nothing, because what a message handler returns never
  reaches the client. The reply goes back through `postToConnection`.
- `Admin command run` carries `routeKey` as `adminDrainQueue`, matched by prefix rather than by an
  exact `routeKey` filter.
- `Unknown action rejected` is the `$default` route.
- `Alert stream closed` is the disconnect, which arrives after the socket has gone.
- Two `ERROR` records have no `Handling WebSocket event` line before them. One is
  `Body validation failed for WebSocket body`, from the alert missing its `message`. The other is
  `No route matched for WebSocket event (eventType: MESSAGE, routeKey: subscribe)`, from a route key
  API Gateway knows and the router does not. Both reach the client as an internal server error
  frame.

### The authorizer log

A full run invokes the authorizer 14 times. `Authorising request` is the router middleware and has 13
of them. The IAM authorized route is not one of them: API Gateway checks a signature itself and calls
no Lambda.

- `Staff token presented` appears 5 times, once per TOKEN invocation, and logs the token's length
  rather than the token.
- `Token decision recorded` appears 4 times. It is the route middleware reading the policy on the way
  back out. It is absent for the revoked token, whose handler throws its policy: the router catches
  the throw above the middleware.
- One of those four carries no `effect`. That is the token whose handler answers with a boolean, so
  there is no policy for the middleware to read.
- `Warehouse read checked` appears 4 times, with `staffId` set or absent. Absent means the route
  answers with a `Deny` and API Gateway returns 403 without invoking the worker.
- `Service call checked` appears twice, once with `authorised` true and once false. It is the
  simple-response route.
- `Reconciliation allowed` and `Reconciliation refused` appear once each, from the policy-mode
  route.
- One `ERROR` record says
  `Boolean responses are only supported for HTTP API (v2) request authorizers using simple response mode`.
  A TOKEN authorizer has no simple response shape, so the router refuses the boolean and the
  invocation fails. API Gateway answers 500.
- One `ERROR` record says
  `No route matched for Lambda Authorizer event (type: REQUEST, method: DELETE)`, and it has no
  `Authorising request` line before it. The router matches a route before it builds the request, so
  the middleware never runs.

## APIs and routes

| API | What reaches the worker |
| --- | --- |
| `OrdersApi` (REST) | Payload format 1.0. A TOKEN authorizer on POST, a REQUEST authorizer on GET and DELETE |
| `FulfilmentApi` (HTTP) | Payload format 1.0 on `/dispatch` and 2.0 elsewhere. Two Lambda authorizers on `/inventory/{sku}`, IAM on its audit route |
| `AlertsApi` (WebSocket) | Six route keys and no authorizer |

The HTTP API has a catch-all integration on payload format 2.0. Any path it does not route explicitly
still reaches the worker, and the router answers the 404.

The TOKEN authorizer answers four ways, picked by the token it is given. Two more tokens drive the
HTTP API's authorizers. `src/utils/constants.ts` holds all six.

## Iterating

```bash
pnpm -F @lambda-event-router/service-example-apigateway diff   # review pending changeset
pnpm -F @lambda-event-router/service-example-apigateway watch  # hotswap deploys
pnpm -F @lambda-event-router/service-example-apigateway synth  # render template
```

## Tear down

```bash
pnpm -F @lambda-event-router/service-example-apigateway destroy
```

The stack owns every resource it creates, including the two log groups, the API key and the usage
plan. Nothing is left behind.
