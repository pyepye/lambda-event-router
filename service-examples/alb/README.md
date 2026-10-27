# Service example: ALB

A deployable CDK app that exercises the `ALBMatcher` end to end. It models a returns desk behind an
Application Load Balancer. One Lambda serves every route, and the trigger calls it from your shell.

The routes are in `src/returnsMatcher.ts`, and the handlers are in `src/handlers/`.

The steps to run it are in [Prerequisites](#prerequisites), [Permissions](#permissions)
and [Deploy](#deploy).

```
returns desk (one load balancer, two listeners)
├── port 80    target group with multi-value headers off
└── port 8080  target group with multi-value headers on

both listeners reach the same routes
├── GET     /returns/open                    listOpenReturns      literal beats the path param
├── GET     /returns/:returnId               getReturn            querySchema, multi-value query
├── HEAD    /returns/:returnId               checkReturn          the matcher strips the body
├── OPTIONS /returns/:returnId               describeReturn       beats the automatic preflight
├── POST    /returns                         createReturn         bodySchema
├── PUT     /returns/:returnId/note          replaceReturnNote    two route middlewares, gzip body
├── PATCH   /returns/:returnId               amendReturnAtDesk    custom filter on x-channel
├── PATCH   /returns/:returnId               amendReturn
├── DELETE  /returns/:returnId               withdrawReturn
├── GET     /returns/merged/:returnId        redirectMergedReturn 307 and 308
├── GET     /returns/:returnId/lines/:lineId getReturnLine        two path params
├── GET     /returns/:returnId/label         getReturnLabel       a binary route
├── GET     /returns/:returnId/pickup        checkReturnPickup    a boolean in an object
├── DELETE  /returns/:returnId/hold          releaseReturnHold    NoContent
├── GET     /carriers/:carrierId/returns     listCarrierReturns   needs the desk role
├── GET     /reports/returns                 summariseReturns     responseSchema the handler fails
├── GET     /reports/returns/queue           summariseReturnQueue responseSchema that Ok fails
├── GET     /reports/returns/count           countOpenReturns     a count in an object
├── GET     /reports/returns.csv             exportReturnsCsv     a literal dot, a text route
├── GET     /reports/labels                  exportReturnLabels   a response ALB rejects
└── POST    /refunds                         refundReturn         throws
```

The listener port is the only thing that picks the event form. The same request list runs twice
against the same routes, so the two forms can be compared side by side.

Note: ALB sends the single-value form by default. A target group sends the multi-value fields only
once `lambda.multi_value_headers.enabled` is set on it. It then stops sending the single-value ones.

## What it covers

One command sends every request on both listeners. Together they hit every filter the matcher
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
| `responseSchema` | `listOpenReturns` passes its own schema, and `summariseReturns` and `summariseReturnQueue` fail theirs, one with a bare value and one through `Ok()` |
| Bare return values | An array and objects, which the matcher answers 200 with a JSON content type |
| Matcher middleware | `logRequest` runs once per matched request |
| Route middleware | `withReturnContext` logs, `requireDeskRole` throws, `withDeskClosure` answers without calling `next` |
| CORS | An origin function, credentials, exposed headers, an automatic preflight, and a registered `options()` route that wins |
| `Vary: Origin` | A request with no `Origin` still gets it, because the origin function makes the response depend on one |
| Multi-value query and headers | A repeated `carrier` and a repeated `x-desk` on both listeners |
| Query encoding | ALB hands the query string over percent encoded, so `reason` reaches the handler encoded |
| Redirect location | ALB expands the relative `Location` the matcher sets into an absolute URL |
| Auth | ALB names no caller, so `auth` is undefined. `targetGroupArn` is read off the raw event |
| `canHandleEvent` | `check` hands the matcher an API Gateway event and it is turned away |
| HEAD responses | `checkReturn` builds a body and the matcher strips it, and so is the body of a HEAD that matches no route |
| Binary request body | `replaceReturnNote` gunzips a note ALB base64 encoded, which only works on bytes that arrived whole |
| `BinaryBody` refusal | A note sent as `text/plain` reads as a string, so the route answers 422 |
| Body that is not JSON | A JSON content type whose body will not parse reaches the schema as a string |
| Binary response body | `getReturnLabel` is a binary route, so the matcher base64 encodes the PNG and sets `isBase64Encoded` |
| Text response | `exportReturnsCsv` is a text route, so the matcher sends the CSV as it is with `text/csv` |
| Escaped path literal | `/reports/returns.csv` matches itself, and `/reports/returnsXcsv` answers 404 |
| Trailing slash | `/returns/open/` reaches the route registered as `/returns/open` |
| WARN records | `requireDeskRole` warns before it refuses a caller, once per reason |
| No route matched | An unrouted path, a HEAD of it, a preflight for it, and a near miss on an escaped dot |
| Schema failures | One query and five bodies |
| Thrown responses | 401, 403, 404, 409, 307 and 308, from handlers and from two middlewares |
| Handler failure | `refundReturn` throws an error, which the matcher answers 500 without its message |
| Oversized response | `exportReturnLabels` returns 1.2 MB of JSON, which is over the 1 MB ALB accepts |

ALB puts no caller identity on the event, so `auth` is undefined. A route that needs a role reads one
from a header instead.

Handlers do their work by logging, so the CloudWatch logs are how you confirm routing. Everything
the matcher answers with is asserted by the trigger.

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
pnpm -F @latcher/service-example-alb... install
pnpm -F @latcher/service-example-alb... build
pnpm -F @latcher/service-example-alb run deploy
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
pnpm -F @latcher/service-example-alb trigger
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
pnpm -F @latcher/service-example-alb trigger

aws logs filter-log-events --log-group-name /aws/lambda/ler-example-alb-worker \
  --start-time $START --output json > /tmp/ler-alb-worker.json
```

Lines appear within a few seconds. Nothing here retries. A line missing after that is a line the run
never wrote. Read the file rather than exporting again for each question.

Note: the log group is `/aws/lambda/<stackName>-worker`, so the name changes if you deploy with a
different `stackName`.

`Handling returns request` is the matcher middleware, and there is one for every request that reached
a route. A full run has 70, half on each listener. Its `eventForm` field says which shape the load
balancer sent, and `targetGroupArn` names the target group it came through.

Eleven requests per listener reach the worker with no `Handling returns request` line:

- Six fail a schema. The matcher validates the query and the body before the middleware chain runs,
  so a request that fails either one gets no further.
- Four match no route, and are answered 404 before any middleware runs. One is
  `/reports/returnsXcsv`, which only matches if the dot in the CSV route is not escaped. One is a
  HEAD, and the matcher strips the body off its 404 as well.
- One is the automatic preflight for `/reports/returns`, which the matcher answers itself.

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
- `targetGroupArn` names the target group the listener served from. The handler reads it off the raw
  event and returns it, so the trigger asserts which listener served the request.
- `Open returns listed` appears five times per listener. One is the plain read, one carries a
  trailing slash, one scopes to a carrier, and two are the CORS steps.
- `Carrier read authorised` and `Carrier returns listed` are the read with the desk role.
- `Carrier read refused, wrong desk role` is a caller the desk can place and will not serve, and it
  answers 403. `Carrier read refused, no desk role` is a caller it cannot place at all, and it
  answers 401. Both are WARN records from the same route middleware.
- `Return note replaced` carries `lines` as 3 and `isBase64Encoded` as true. The note is gzipped, so
  ALB base64 encodes it on both listeners and the matcher hands the bytes over as a `Buffer`. Gunzip
  only reads a body that arrived whole, so the line count proves no byte was lost. `bodyType` is
  `Buffer`, and `bytes` is the length of the archive the caller sent.
- `Return note authorised` is the second route middleware on that request, and it runs after the
  matcher middleware.
- `Return note refused, the desk is closed` is the first one answering on its own. It returns a 409
  rather than calling `next`, so neither the second middleware nor the handler runs.
- `Return label read` is the binary route. The matcher base64 encodes the buffer and sets
  `isBase64Encoded`, and the trigger compares the bytes that came off the wire with the ones the
  handler holds.
- `Open returns counted` is the count route. The matcher sends `{"open":1}` back as the body.
- `Return pickup checked` appears twice per listener. Both answer 200, with `awaitingPickup` set to
  `true` for a return holding units and `false` for a settled one.
- `Return hold released` returns `NoContent()`, which the matcher answers 204.
- `Return queue summarised` carries the same kind of negative count as the summary route, and is
  followed by the same error. The matcher checks a body returned through `Ok()` against the
  `responseSchema` too.
- `Returns exported` is the text route. The matcher sends the string back as it is, with the
  `text/csv` content type the route names.
- `Return amended at the desk` is the custom filter winning. `Return amended` is the same method and
  path without the `x-channel` header.
- `Return line read` proves both path params reach the handler. It returns the line on its own, so
  the matcher picks the status and the JSON content type.
- `Return checked` is the HEAD route. It builds the same response as the GET route and the matcher
  strips the body.
- `Return options described` is the registered `options()` route answering a preflight itself.
- `Return created` and `Return withdrawn` are the create and the delete.
- `Merged return redirected` and `Return under review redirected` are the two redirects.
- The load balancer expands the relative `Location` both redirects set, so the caller sees an
  absolute URL.
- `Returns summarised` is followed by an error. The count the handler returned is negative and its
  own `responseSchema` requires a number that is not.
- `Return labels exported` carries `bytes` as 1245001. The worker returns that response and the load
  balancer refuses it. The trigger sees a 502 the log has no record of.

Four requests per listener match a route, log the matcher middleware and then log nothing else. Each
throws its response before the handler reaches its own log line. They are a return that does not
exist, a return that already exists, a return that still holds units, and a return with no label.

The run has six `ERROR` records, three per listener. Each is the matcher reporting a handler it had
already run:

- `Handler response failed its responseSchema` appears twice, with the issues the summary and the
  queue schemas raised.
- `Unhandled error processing HTTP request` carries `Refunds are unavailable for ret-8801`. That is
  the error `refundReturn` threw. The matcher logs its message and leaves it out of the 500 body.

## Listeners and routes

| Resource | What it does |
| --- | --- |
| `ReturnsAlb` | One internet-facing load balancer, HTTP only, in two public subnets |
| `SingleValueTargetGroup` | Multi-value headers off, reached on port 80 |
| `MultiValueTargetGroup` | `lambda.multi_value_headers.enabled` set to `true`, reached on port 8080 |
| `WorkerFn` | The one Lambda behind both target groups |

Both target groups point at the same Lambda, so one route table serves both event forms. Neither
listener has a rule, so every path reaches the worker and the matcher answers the 404s.

## Iterating

```bash
pnpm -F @latcher/service-example-alb check   # route the request list in process
pnpm -F @latcher/service-example-alb diff    # review pending changeset
pnpm -F @latcher/service-example-alb watch   # hotswap deploys
pnpm -F @latcher/service-example-alb synth   # render template
```

`check` drives the matcher with a synthetic event for every step. It catches a filter that can never
match without waiting for a deploy.

## Tear down

```bash
pnpm -F @latcher/service-example-alb destroy
```

The stack owns every resource it creates, including the VPC and the log group. Nothing is left
behind.

A load balancer is billed by the hour whether anything calls it or not. Destroy the stack once you
have read the logs.
