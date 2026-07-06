# Service example: AppSync

A deployable CDK app that exercises all four AppSync routers end to end. It models a support desk.
A GraphQL API serves tickets, an Event API carries live activity, and one Lambda authorizer guards
both.

```
SupportApi (GraphQL, Lambda authorization)
├── getTicketForAgent      (custom filter: the caller's role is agent)
├── getTicketForCustomer   (same field, every other caller)
├── listWorkItems          (fieldName filter: list*)
├── createTicket           (mutation, arguments schema)
├── escalateTicket         (mutation, always throws)
├── resolveTicketComments  (parentTypeName filter: Ticket, batched)
├── watchTicketCreated     (subscription)
└── Mutation.closeTicket   (a resolver with no route)

ActivityApi (Event API, API key)
├── holdTypingNotice       (custom filter: the whole batch is typing notices)
├── recordTicketActivity   (publish on /ticket/*)
├── admitTicketWatcher     (subscribe on /ticket/*)
├── trackPresence          (channelNamespace filter: presence, both operations)
└── archiveAuditEntry      (channelNamespace filter: audit, publish only)

AuthorizerFn, GraphQL
├── authoriseAdminOperation  (operationName filter: AdminAudit, custom filter: an agent token)
└── authoriseSupportToken    (every other caller)

AuthorizerFn, Event API
├── admitActivityConnection  (custom filter: the token is known)
├── refuseUnknownConnection  (every other connect)
├── authoriseTicketActivity  (publish on /ticket/*)
├── admitPresenceWatcher     (subscribe on /presence/*)
└── refuseAuditAccess        (channelNamespace filter: audit)
```

## What it covers

One `trigger` run makes GraphQL calls, opens subscriptions and sends publishes. Together they hit
every filter the four routers offer, both kinds of failure, and every authorizer response.

| Feature | Where |
| --- | --- |
| `parentTypeName` filter | `resolveTicketComments` matches the `Ticket` type and runs as a field resolver |
| Batched resolvers | `Ticket.comments` sets `maxBatchSize`, so a page of tickets resolves in one invocation |
| Per-entry resolver failure | `batchItemFailures` reports the closed ticket on its own and the rest still resolve |
| `fieldName` filter | `listWorkItems` matches `list*`, so one route serves `listTickets` and `listQueues` |
| `custom` filter on a resolver | `getTicketForAgent` reads the role the authorizer set |
| `query`, `mutation` and `subscription` | The routes registered by field name, rather than by full filters |
| Arguments schema | `TicketIdSchema` on the two ticket reads, `NewTicketSchema` on `createTicket` |
| Resolver router middleware | `logResolverRequest` runs once per resolver invocation |
| Resolver route middleware | `withTicketContext` on the agent read |
| No route matched on a resolver | `Mutation.closeTicket` has a resolver on the API and no route here |
| Handler failure on a resolver | `escalateTicket` throws after its middleware has run |
| Schema failures | A ticket id that is not `t-<number>`, and a priority outside the enum |
| `operation` filter | `trackPresence` takes both `PUBLISH` and `SUBSCRIBE` on one route |
| `channelPath` filter | The ticket routes match `/ticket/*` |
| `channelNamespace` filter | `trackPresence` matches `presence` and `archiveAuditEntry` matches `audit` |
| `custom` filter on an Event API route | `holdTypingNotice` drops a batch of typing notices |
| `publish` and `subscribe` | The ticket routes, registered by channel path |
| Events router middleware | `logEventsRequest` runs once per publish or subscribe |
| Events route middleware | `withChannelContext` on `recordTicketActivity` |
| Several events in one invocation | A publish carries its whole batch into one handler call |
| Per-event failure | `recordTicketActivity` rejects an event with no body and broadcasts the rest |
| No route matched on the Event API | The audit namespace has a subscribe handler and no subscribe route |
| Handler failure on the Event API | `archiveAuditEntry` throws on an entry that names no actor |
| `operationName` filter | `authoriseAdminOperation` matches the named admin operation and nothing else |
| `custom` filter on an authorizer | The same route also requires an agent token, so a customer falls through |
| `Authorized` | The agent and customer tokens, the second one carrying `deniedFields` |
| `Denied` | The revoked token is denied by the handler |
| A thrown response | The expired token is denied by middleware, which throws the response |
| Authorizer failure | The broken token throws a real error, so the call answers 500 |
| Event API `connect`, `publish` and `subscribe` | The three operations the Event API authorises, each on its own route |
| `custom` filter on an Event API authorizer | `admitActivityConnection` matches a known token, and the next route takes the rest |
| `channelNamespace` filter on an Event API authorizer | `refuseAuditAccess` turns away every operation on the audit namespace |
| `EventsAuthorized` with `handlerContext` | The agent's role reaches the publish handler as `identity.handlerContext` |
| `EventsDenied` | A customer publishing to a ticket channel, and anything on the audit namespace |
| No route matched on an Event API authorizer | Nothing authorises a subscribe to a ticket channel |
| `canHandleEvent` | Each router is handed the other three event shapes and turns them away |

AppSync copies the authorizer's `resolverContext` onto `identity` for every resolver the request
reaches. It takes string values only, so the role the custom filter reads is a plain string.

The authorizer's `operationName` comes from the request body rather than the query text. The trigger
sends it alongside `query`, because naming the operation in the query alone leaves the field off.

The publish API takes each event as a JSON string. AppSync parses it before the worker sees it. The
handler is given an object under `payload`, alongside an id AppSync minted.

The trigger sends anonymous GraphQL operations, so AppSync leaves `operationName` off most authorizer
events. `canHandleEvent` allows that, and would reject any other type for the field. A WebSocket
connection is the exception, and arrives with an `operationName` of `Deepdish:Connect`.

A publish answers with what the API accepted, not with what the handler broadcast. A handler that
returns an empty list still gets a `successful` entry for every event sent.

Handlers do their work by logging and returning. The responses and the CloudWatch logs are how you
confirm routing.

## Prerequisites

- AWS account with credentials on the shell
- `AWS_REGION` set to the region the stack is deployed in
- CDK bootstrap already run for the target account / region
- Node 24 and pnpm installed

## Permissions

`deploy-policy.json` holds the minimum permissions needed to deploy this example and test it. Attach
it to the user or role you run the commands with.

CloudFormation work is done by the CDK bootstrap roles, so the policy only allows assuming those
roles. The rest covers reading the stack outputs and the two log groups. The requests themselves
carry a token or an API key over HTTPS and need no AWS permissions.

Note: the policy assumes the default bootstrap qualifier `hnb659fds`. Change the role and parameter
ARNs if your account uses a custom one.

## Deploy

From this directory:

```bash
pnpm -F @lambda-event-router/service-example-appsync build
pnpm -F @lambda-event-router/service-example-appsync run deploy
```

CDK outputs include `SupportApiUrl`, `SupportApiRealtimeUrl`, `ActivityApiHttpDns`,
`ActivityApiRealtimeDns` and `ActivityApiKey`.

The GraphQL API takes Lambda authorization and nothing else, so every call reaches the authorizer.
Its cache TTL is zero, and every response sets `ttlOverride` to zero as well. A second run of the
trigger is authorised again rather than served from the cache.

The Event API takes the same authorizer alongside its API key. A request carrying `x-api-key` skips
the authorizer, and one carrying `Authorization` reaches it. Both are exercised.

The Event API's three namespaces send both operations straight to the worker. That is what puts a
subscribe in front of the router.

The `Ticket.comments` resolver sets `maxBatchSize` to 5. The comments for a page of tickets then
reach the worker in one invocation. The field is nullable, because a non-null field would carry a
per-entry error up to the whole list.

Both APIs are reachable by anyone holding the token or the key while the stack is up. The example
holds three hard-coded tickets and writes nothing down.

## Send sample requests

```bash
pnpm -F @lambda-event-router/service-example-appsync trigger
```

The script reads the stack outputs itself, so it takes no arguments. Pass a stack name as the first
argument if you deployed with a different one.

Each step is asserted on its status code and its body. A line per step says whether it passed.

Nothing it sends changes any state, so running it twice in a row gives the same answer.

Some GraphQL calls never reach the worker. The authorizer refuses three of them, and `deniedFields`
blocks another before its resolver runs.

Two kinds of step carry more than one item into a single invocation. AppSync hands a whole publish to
one invocation, and it batches the comments for a page of tickets into another.

That is where per-item failures and ordering show up. The ticket list holds one closed ticket, whose
comments throw, and the other two still come back.

## Checking the logs

Save both log groups to one file:

```bash
aws logs tail /aws/lambda/ler-example-appsync-worker --since 10m --format short > /tmp/ler-appsync.log
aws logs tail /aws/lambda/ler-example-appsync-authorizer --since 10m --format short >> /tmp/ler-appsync.log
```

Lines appear within a few seconds. Nothing here retries, so a line that is missing after that is a
line the run never wrote.

Note: the log groups are `/aws/lambda/<stackName>-worker` and `/aws/lambda/<stackName>-authorizer`,
so the names change if you deploy with a different `stackName`.

`Authorising request` is the authorizer's router middleware, and there is one for every token the
API is asked about. The GraphQL subscription adds two of its own, because AppSync authorises the
WebSocket connection and the subscription separately.

`Admin operation authorised` is the filtered route. It runs only for a caller who names the admin
operation and holds an agent token. A customer naming the same operation falls past it to the route
below.

The authorizer log then splits four ways:

- `Token accepted` is the agent and customer tokens. Its `role` field is what the resolver custom
  filter later reads.
- `Token refused` is the revoked token. The handler returned `Denied`.
- `Token expired` is the expired token. The middleware threw `Denied`, and the router recognised the
  thrown response and handed it back.
- An `ERROR` record with no outcome line above it is the broken token, where the handler threw a
  real error rather than a response.

The two denials answer 401 with `UnauthorizedException`, and only these log lines tell them apart. A
failed authorizer answers 500 with `AuthorizerFailureException` and the error's own message.

`Authorising channel request` is the Event API authorizer's router middleware. It has an `operation`
of `EVENT_CONNECT`, `EVENT_PUBLISH` or `EVENT_SUBSCRIBE`, and a `channelPath` on all but the connect.

The Event API authorizer lines say which route ran:

- `Activity connection admitted` is a connect whose token the custom filter recognised.
- `Activity connection refused` is a connect from the revoked token, which the next route took.
- `Ticket publish authorised` is the agent. Its `handlerContext` comes back as `role` on the worker's
  `Handling events request` line, which is the Event API's answer to `resolverContext`.
- `Ticket publish refused` is the customer, who may read tickets and not write to them.
- `Presence watcher authorised` is the only subscribe with a route.
- `Audit access refused` is the namespace filter, which turns away every operation on the trail.
- `No authorizer route matched for EVENT_SUBSCRIBE on channel /ticket/*` is the gap. Nothing
  authorises a ticket subscribe, so the router throws and the client gets an error.

Note: none of the Event API authorizer lines appear for a request carrying `x-api-key`. The API key
is checked by AppSync and never reaches the function.

`Handling resolver request` is the resolver router middleware, and there is one for every field
that reached a route. Its `field` field names the route that matched, and `selectionSet` lists the
fields the caller asked for.

A batched resolver logs one line per entry, so the ticket list contributes one per ticket.

The resolver lines below it say which route ran:

- `Agent ticket lookup started` then `Ticket read by agent` is the agent read. The first line is the
  route middleware, which only this route carries.
- `Ticket read by customer` is the same field reached by the customer token. The custom filter did
  not match, so the next route took it.
- `Ticket comments resolved` is the field resolver on the `Ticket` type, once per open ticket whose
  comments were asked for. It runs after the ticket it belongs to has been returned.
- `Tickets listed` and `Queues listed` come from the same route. The `list*` field name matches both
  fields, and `info.fieldName` is what separates them.
- `Ticket created` is the mutation whose arguments passed `NewTicketSchema`.
- `Ticket feed subscription opened` is the subscription resolver. AppSync runs it when a client
  subscribes, not when an event arrives.

The resolver failures each leave an `ERROR` record in the worker log:

- `Escalation queue unavailable for t-1` comes from the handler. It has a `Handling resolver request`
  line above it, because the middleware chain had already run.
- `No route matched for Mutation.closeTicket` is the field with a resolver and no route.
- `Arguments validation failed for Query.getTicket` is the ticket id that is not `t-<number>`.
- `Arguments validation failed for Mutation.createTicket` is the priority outside the enum.
- `Error processing AppSync batch item 2` is the closed ticket in the batched comments lookup. Its
  `error.message` is `Comments for t-3 are archived`.

Note: neither validation failure has a `Handling resolver request` line. The router validates the
arguments before it runs any middleware.

The batch item is the only failure whose invocation still succeeds. `batchItemFailures` turns it into
an error entry in place, so the other two tickets in that batch return their comments.

`Handling events request` is the events router middleware, and there is one for every publish and
every subscribe. Its `eventCount` field is the size of the batch, and 0 for a subscribe.

The Event API lines say which route ran:

- `Ticket activity received` is the route middleware, once for each publish that reached
  `recordTicketActivity`. The typing publish does not have it.
- `Ticket activity recorded` is one line per event that carried a body.
- `Ticket activity rejected` is the event with no body. It goes back as a per-event error and the
  rest of its batch still broadcasts.
- `Typing notices dropped` is the custom filter matching, because every event in that batch was a
  typing notice. Its `count` field is the size of the batch.
- `Ticket watcher admitted` is the subscribe that found a route on the ticket channels.
- `Desk joined presence` and `Presence heartbeat recorded` come from the same route. It filters on
  the namespace and takes both operations, and `operation` is what separates them.
- `Audit entry archived` is the entry that names an actor.

The Event API failures are:

- `Audit entry <id> names no actor` comes from the handler. It has a `Handling events request` line
  above it, and the id is the one AppSync minted for that event.
- `No route matched for SUBSCRIBE on channel /audit/*` is the subscribe with no route. The audit
  namespace sends it to the worker anyway.

Both answer the publisher with 502 and `DependencyFailedException`. The message is always `Unable to
process request`, so the worker log is where the reason is.

The first ticket publish is the one to read for what a healthy batch looks like. Its events arrive in
one invocation, they all come back, and the publish answers with an empty `failed` list.

A per-event error reads differently. It lands in `failed` under `message`, in the handler's own
words, alongside the event's `index` and a `code` of `CustomError`.

## APIs and routes

| API | Auth | Routes |
| --- | --- | --- |
| `SupportApi` | Lambda authorizer | `getTicketForAgent`, `getTicketForCustomer`, `listWorkItems`, `createTicket`, `escalateTicket`, `resolveTicketComments`, `watchTicketCreated` |
| `ActivityApi` | API key or the same authorizer | `holdTypingNotice`, `recordTicketActivity`, `admitTicketWatcher`, `trackPresence`, `archiveAuditEntry` |

The worker serves both APIs from one function, and the authorizer serves both from another. Each
function holds two routers, and `LambdaRouter` picks between them by event shape.

The Event API has three namespaces. `ticket` and `presence` have routes for both operations, and
`audit` has a publish route only.

## Iterating

```bash
pnpm -F @lambda-event-router/service-example-appsync check   # route the step list in process
pnpm -F @lambda-event-router/service-example-appsync diff    # review pending changeset
pnpm -F @lambda-event-router/service-example-appsync watch   # hotswap deploys
pnpm -F @lambda-event-router/service-example-appsync synth   # render template
```

`check` drives all three routers with a synthetic event for every step. It catches a filter that can
never match without waiting for a deploy.

## Tear down

```bash
pnpm -F @lambda-event-router/service-example-appsync destroy
```

Both APIs, both log groups and both functions belong to the stack, so nothing is left behind.
