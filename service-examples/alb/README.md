# Service example: ALB

A deployable CDK app that exercises the `ALBRouter` end to end. It models a returns desk behind an
Application Load Balancer. One Lambda serves every route, and the trigger calls it from your shell.

```
returns desk (one load balancer, two listeners)
├── port 80    target group with multi-value headers off
└── port 8080  target group with multi-value headers on

both listeners reach the same routes
├── GET     /returns/open                    listOpenReturns      literal beats the path param
├── GET     /returns/:returnId               getReturn            querySchema, multi-value query
├── HEAD    /returns/:returnId               checkReturn          the router strips the body
├── OPTIONS /returns/:returnId               describeReturn       beats the automatic preflight
├── POST    /returns                         createReturn         bodySchema
├── PUT     /returns/:returnId/note          replaceReturnNote    two route middlewares, gzip body
├── PATCH   /returns/:returnId               amendReturnAtDesk    custom filter on x-channel
├── PATCH   /returns/:returnId               amendReturn
├── DELETE  /returns/:returnId               withdrawReturn
├── GET     /returns/merged/:returnId        redirectMergedReturn 307 and 308
├── GET     /returns/:returnId/lines/:lineId getReturnLine        two path params
├── GET     /returns/:returnId/label         getReturnLabel       a PNG response
├── GET     /returns/:returnId/pickup        checkReturnPickup    a bare boolean
├── DELETE  /returns/:returnId/hold          releaseReturnHold    a bare empty object
├── GET     /carriers/:carrierId/returns     listCarrierReturns   needs the desk role
├── GET     /reports/returns                 summariseReturns     responseSchema the handler fails
├── GET     /reports/returns/queue           summariseReturnQueue responseSchema the router skips
├── GET     /reports/returns/count           countOpenReturns     a bare number
├── GET     /reports/returns.csv             exportReturnsCsv     a literal dot, a string body
├── GET     /reports/labels                  exportReturnLabels   a response ALB rejects
└── POST    /refunds                         refundReturn         throws
```

The listener port is the only thing that picks the event form. The same request list runs twice
against the same routes, so the two forms can be compared side by side.

Note: ALB sends the single-value form by default. A target group sends the multi-value fields only
once `lambda.multi_value_headers.enabled` is set on it. It then stops sending the single-value ones.

## What it covers

One command sends every request on both listeners. Together they hit every filter the router
supports and every failure path it has.

| Feature | Where |
| --- | --- |
| Single-value event form | The port 80 listener, with multi-value headers off |
| Multi-value event form | The port 8080 listener, with `lambda.multi_value_headers.enabled` set |
| `method` filter | GET, POST, PUT, PATCH, DELETE, HEAD and OPTIONS |
| `path` filter | Path params, two params in one path, and a literal outranking a param |
| `custom` filter | `amendReturnAtDesk` reads a header the schemas never see |
| `defineRoute` | Fourteen routes, including the one that takes a `custom` |
| Convenience methods | `get`, `post`, `put`, `patch`, `delete`, `head` and `options`, one route each |
| `querySchema` | `getReturn` coerces `page` to a number |
| `bodySchema` | `createReturn`, `amendReturn`, `amendReturnAtDesk` and `refundReturn`, and `replaceReturnNote` takes `BinaryBody` |
| `responseSchema` | `listOpenReturns` passes its own schema, `summariseReturns` fails its own, and `summariseReturnQueue` builds its own response so the router never runs the schema |
| Bare return values | An array, an object, a number, `false`, `true` and `{}`, and the router picks the status for each |
| Router middleware | `logRequest` runs once per matched request |
| Route middleware | `withReturnContext` logs, `requireDeskRole` throws, `withDeskClosure` answers without calling `next` |
| CORS | An origin function, credentials, exposed headers, an automatic preflight, and a registered `options()` route that wins |
| `Vary: Origin` | A request with no `Origin` still gets it, because the origin function makes the response depend on one |
| Multi-value query and headers | A repeated `carrier` and a repeated `x-desk` on both listeners |
| Query encoding | ALB hands the query string over percent encoded, so `reason` reaches the handler encoded |
| Redirect location | ALB expands the relative `Location` the router sets into an absolute URL |
| Auth | `targetGroupArn` is the only field ALB fills, and it names the listener that served the request |
| `canHandleEvent` | `check` hands the router an API Gateway event and it is turned away |
| HEAD responses | `checkReturn` builds a body and the router strips it, and so is the body of a HEAD that matches no route |
| Binary request body | `replaceReturnNote` gunzips a note ALB base64 encoded, which only works on bytes that arrived whole |
| `BinaryBody` refusal | A note sent as `text/plain` reads as a string, so the route answers 422 |
| Body that is not JSON | A JSON content type whose body will not parse reaches the schema as a string |
| Binary response body | `getReturnLabel` returns a PNG, and the router base64 encodes it and sets `isBase64Encoded` |
| String response | `exportReturnsCsv` returns CSV, so the router sets no JSON content type |
| Escaped path literal | `/reports/returns.csv` matches itself, and `/reports/returnsXcsv` answers 404 |
| Trailing slash | `/returns/open/` reaches the route registered as `/returns/open` |
| WARN records | `requireDeskRole` warns before it refuses a caller, once per reason |
| No route matched | An unrouted path, a HEAD of it, a preflight for it, and a near miss on an escaped dot |
| Schema failures | One query and five bodies |
| Thrown responses | 401, 403, 404, 409, 307 and 308, from handlers and from two middlewares |
| Handler failure | `refundReturn` throws an error, which the router answers 500 |
| Oversized response | `exportReturnLabels` returns 1.1 MB, which is over the 1 MB ALB accepts |

ALB puts no caller identity on the event. `auth.targetGroupArn` is set and every other `auth` field
is undefined. A route that needs a role reads one from a header instead.

Handlers do their work by logging, so the CloudWatch logs are how you confirm routing. Everything
the router answers with is asserted by the trigger.

## Prerequisites

- AWS account with credentials on the shell
- `AWS_REGION` set to the region the stack is deployed in
- CDK bootstrap already run for the target account / region
- Node 24 and pnpm installed

## Permissions

`deploy-policy.json` holds the minimum permissions needed to deploy this example and test it. Attach
it to the user or role you run the commands with.

CloudFormation work is done by the CDK bootstrap roles, so the policy only allows assuming those
roles. The rest covers reading the stack outputs and the worker log group. The requests themselves
go over plain HTTP and need no permissions at all.

Note: the policy assumes the default bootstrap qualifier `hnb659fds`. Change the role and parameter
ARNs if your account uses a custom one.

## Deploy

From this directory:

```bash
pnpm -F @lambda-event-router/service-example-alb build
pnpm -F @lambda-event-router/service-example-alb run deploy
```

CDK outputs include `AlbDnsName`, `SingleValueTargetGroupArn`, `MultiValueTargetGroupArn` and
`WorkerLogGroupName`.

The stack creates its own VPC with two public subnets, one per availability zone, because an ALB
needs two. There is no NAT gateway. The worker sits outside the VPC, because a Lambda target is
invoked through the Lambda API.

Both listeners take plain HTTP from anywhere, so the desk is reachable by anyone while the stack is
up. It holds two hard-coded returns and writes nothing down.

Neither target group has a health check. A health check invokes the worker on a timer, which puts
events in the log the trigger never sent.

## Send sample requests

```bash
pnpm -F @lambda-event-router/service-example-alb trigger
```

The script reads the stack outputs itself, so it takes no arguments. Pass a stack name as the first
argument if you deployed with a different one.

It sends 46 requests to the port 80 listener and the same 46 to port 8080. Each one is asserted on
its status code, and on a body or a header. A line per step says whether it passed. Nothing it sends
changes any state, so running it twice in a row gives the same answer.

Only the return read answers differently between the two event forms. It repeats a query param and
a header, and a single-value target group carries one value for each.

ALB invokes the Lambda once per request, so no invocation here holds more than one event.

## Checking the logs

Take the epoch before you trigger, then export the worker log:

```bash
START=$(($(date +%s) * 1000))
pnpm -F @lambda-event-router/service-example-alb trigger

aws logs filter-log-events --log-group-name /aws/lambda/ler-example-alb-worker \
  --start-time $START --output json > /tmp/ler-alb-worker.json
```

Lines appear within a few seconds. Nothing here retries. A line missing after that is a line the run
never wrote. Read the file rather than exporting again for each question.

Note: the log group is `/aws/lambda/<stackName>-worker`, so the name changes if you deploy with a
different `stackName`.

`Handling returns request` is the router middleware, and there is one for every request that reached
a route. A full run has 70, half on each listener. Its `eventForm` field says which shape the load
balancer sent, and `targetGroupArn` names the target group it came through.

Eleven requests per listener reach the worker with no `Handling returns request` line:

- Six fail a schema. The router validates the query and the body before the middleware chain runs,
  so a request that fails either one gets no further.
- Four match no route, and are answered 404 before any middleware runs. One is
  `/reports/returnsXcsv`, which only matches if the dot in the CSV route is not escaped. One is a
  HEAD, and the router strips the body off its 404 as well.
- One is the automatic preflight for `/reports/returns`, which the router answers itself.

The rest of the log is one line per handler:

- `Return read` is where the two event forms differ. The request repeats `carrier` in the query and
  `x-desk` in the headers, and each listener collapses them differently.
- On port 8080 `carriers` is `['dpd', 'evri']` and `deskHeaders` is `['leeds', 'hull']`. The flat
  `carrier` and `deskHeader` both hold the last value.
- On port 80 `carriers` is `['evri']` and `deskHeaders` is `['hull']`. A single-value target group
  keeps the last value of a repeat and drops the rest.
- `page` is the number 2 on both, since the querySchema coerces it.
- `reason` is `damaged%20in%20transit` on both. ALB does not decode the query string, so a handler
  that wants the space back has to decode it itself.
- `principalId` is undefined on both. ALB names no caller, so `targetGroupArn` is the only `auth`
  field with anything in it. The handler returns the whole `auth` object, so the trigger asserts the
  target group the listener served from and the absence of a caller.
- `Open returns listed` appears five times per listener. One is the plain read, one carries a
  trailing slash, one scopes to a carrier, and two are the CORS steps.
- `Carrier read authorised` and `Carrier returns listed` are the read with the desk role.
- `Carrier read refused, wrong desk role` is a caller the desk can place and will not serve, and it
  answers 403. `Carrier read refused, no desk role` is a caller it cannot place at all, and it
  answers 401. Both are WARN records from the same route middleware.
- `Return note replaced` carries `lines` as 3 and `isBase64Encoded` as true. The note is gzipped, so
  ALB base64 encodes it on both listeners and the router hands the bytes over as a `Buffer`. Gunzip
  only reads a body that arrived whole, so the line count proves no byte was lost. `bodyType` is
  `Buffer`, and `bytes` is the length of the archive the caller sent.
- `Return note authorised` is the second route middleware on that request, and it runs after the
  router middleware.
- `Return note refused, the desk is closed` is the first one answering on its own. It returns a 409
  rather than calling `next`, so neither the second middleware nor the handler runs.
- `Return label read` is the PNG route. The router base64 encodes the buffer and sets
  `isBase64Encoded`, and the trigger compares the bytes that came off the wire with the ones the
  handler holds.
- `Open returns counted` is the bare number route. The router sends `1` back as the body.
- `Return pickup checked` appears twice per listener. A return holding units answers 204, because a
  bare `true` is no content to the router. A settled one answers 200 with the body `false`.
- `Return hold released` returns an empty object, which the router answers 204.
- `Return queue summarised` carries the same kind of negative count as the summary route. It answers
  200, because a handler that builds its own response skips the `responseSchema`.
- `Returns exported` is the CSV route. The router sends the string back with no JSON content type,
  because only an object or an array gets one.
- `Return amended at the desk` is the custom filter winning. `Return amended` is the same method and
  path without the `x-channel` header.
- `Return line read` proves both path params reach the handler. It returns the line on its own, so
  the router picks the status and the JSON content type.
- `Return checked` is the HEAD route. It builds the same response as the GET route and the router
  strips the body.
- `Return options described` is the registered `options()` route answering a preflight itself.
- `Return created` and `Return withdrawn` are the create and the delete.
- `Merged return redirected` and `Return under review redirected` are the two redirects.
- The load balancer expands the relative `Location` both redirects set, so the caller sees an
  absolute URL.
- `Returns summarised` is followed by an error. The count the handler returned is negative and its
  own `responseSchema` requires a number that is not.
- `Return labels exported` carries `bytes` as 1170000. The worker returns that response and the load
  balancer refuses it. The trigger sees a 502 the log has no record of.

Four requests per listener match a route, log the router middleware and then log nothing else. Each
throws its response before the handler reaches its own log line. They are a return that does not
exist, a return that already exists, a return that still holds units, and a return with no label.

The run has four `ERROR` records, two per listener. Both are the router reporting a handler it had
already run:

- `Handler response failed its responseSchema` carries the issues the summary schema raised.
- `Unhandled error processing HTTP request` carries `Refunds are unavailable for ret-8801`. That is
  the error `refundReturn` threw, and the router put its message in the 500 body.

## Listeners and routes

| Resource | What it does |
| --- | --- |
| `ReturnsAlb` | One internet-facing load balancer, HTTP only, in two public subnets |
| `SingleValueTargetGroup` | Multi-value headers off, reached on port 80 |
| `MultiValueTargetGroup` | `lambda.multi_value_headers.enabled` set to `true`, reached on port 8080 |
| `WorkerFn` | The one Lambda behind both target groups |

Both target groups point at the same Lambda, so one route table serves both event forms. Neither
listener has a rule, so every path reaches the worker and the router answers the 404s.

## Iterating

```bash
pnpm -F @lambda-event-router/service-example-alb check   # route the request list in process
pnpm -F @lambda-event-router/service-example-alb diff    # review pending changeset
pnpm -F @lambda-event-router/service-example-alb watch   # hotswap deploys
pnpm -F @lambda-event-router/service-example-alb synth   # render template
```

`check` drives the router with a synthetic event for every step. It catches a filter that can never
match without waiting for a deploy.

## Tear down

```bash
pnpm -F @lambda-event-router/service-example-alb destroy
```

The stack owns every resource it creates, including the VPC and the log group. Nothing is left
behind.

A load balancer is billed by the hour whether anything calls it or not. Destroy the stack once you
have read the logs.
