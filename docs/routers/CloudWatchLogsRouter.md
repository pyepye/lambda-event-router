# CloudWatchLogsRouter

`CloudWatchLogsRouter` routes a CloudWatch Logs subscription delivery to a handler.

A subscription filter forwards matching log events to your Lambda as a gzipped, base64 payload. The
router decodes it into log events and their metadata, then works out which of your routes should
handle it by log group, subscription filter or message type.

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/cloudwatch
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports
`LambdaRouter`, which every router plugs into.

## Create the router

```ts
import { createCloudWatchLogsRouter } from '@lambda-event-router/cloudwatch'
import { logInvocation } from './middleware/logInvocation'

const cloudWatchLogsRouter = createCloudWatchLogsRouter({
  middleware: [logInvocation],  // Optional
})
```

`middleware` is the only option and it can be left out. `createCloudWatchLogsRouter()` on its own
gives you a router with no shared middleware.

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `middleware` | `CloudWatchLogsMiddleware[]` | No | `[]` | Runs for every delivery this router handles, before any route middleware. See [Middleware](#middleware) |

## Register routes

```ts
cloudWatchLogsRouter.route({
  filters: {
    logGroup: '/aws/lambda/my-function',
    messageType: 'DATA_MESSAGE',
  },
  middleware: [withRequestContext],  // Optional
  handler: processLogs,
})
```

`filters` and `handler` are required, though `filters` can be an empty object to match every delivery.

`route()` returns the router, so you can chain registrations.

```ts
cloudWatchLogsRouter.route(lambdaLogsRoute).route(ecsLogsRoute)
```

Routes match in registration order and the first match wins, so give each route filters no other
route can match. See [match order](/docs/routing#match-order) for what goes wrong when they overlap.

A subscription carries decoded log data whose shape CloudWatch fixes rather than a payload you
control, so there is no schema to attach and nothing to validate. Match on the log group, the
subscription filter or the message type instead.

**A delivery that matches no route throws**, which fails the whole invocation. Register a route with
empty `filters` as a catch-all if you would rather swallow log groups you do not recognise, and see
[nothing matched](/docs/routing#nothing-matched) for what the other routers do instead.

### Convenience methods

`dataMessage()` and `controlMessage()` set the `messageType` filter for you, so you pass everything
except that key. The two calls below register the same route.

```ts
cloudWatchLogsRouter.dataMessage({
  filters: { logGroup: '/aws/lambda/my-function' },
  handler: processLogs,
})

cloudWatchLogsRouter.route({
  filters: { logGroup: '/aws/lambda/my-function', messageType: 'DATA_MESSAGE' },
  handler: processLogs,
})
```

| Method | Sets | Takes |
| --- | --- | --- |
| `dataMessage()` | `messageType: 'DATA_MESSAGE'` | The filters without `messageType`, plus `middleware` and `handler` |
| `controlMessage()` | `messageType: 'CONTROL_MESSAGE'` | The same |

Each drops the `messageType` key from the filters you pass and sets it itself, so putting a
`messageType` in the object is a type error. CloudWatch sends a `CONTROL_MESSAGE` once to check the
subscription is reachable and it carries no log events, so `controlMessage()` is where you handle or
ignore that. See [convenience methods](/docs/routing#convenience-methods) for how the other routers
use them.

## Filters

Every filter key on one route, showing each form a value can take. All of them are optional, so set
the ones that pick out the deliveries you want and leave the rest off.

```ts
cloudWatchLogsRouter.route({
  filters: {
    logGroup: ['/aws/lambda/my-function', '/aws/lambda/other-function'], // Or a pattern: /^\/aws\/lambda\//
    subscriptionFilter: 'error-alerts',
    messageType: ['DATA_MESSAGE', 'CONTROL_MESSAGE'],
    custom: ({ logEvents }) => logEvents.some((event) => event.message.includes('ERROR')),
  },
  handler: processLogs,
})
```

| Filter | Type | Description |
| --- | --- | --- |
| `logGroup` | `FilterStringMatcher` | Matches against the delivery's log group name |
| `subscriptionFilter` | `FilterStringMatcher` | Matches if any of the delivery's subscription filter names match. The record field is `subscriptionFilters`, an array, and this key matches when one of them does |
| `messageType` | `'DATA_MESSAGE' \| 'CONTROL_MESSAGE'` or an array of either | Matches the message type CloudWatch sends |
| `custom` | `(input: CloudWatchLogsDecodedData) => boolean \| Promise<boolean>` | Anything the other filters cannot express. Can be async |

`FilterStringMatcher` is `string | RegExp | Array<string | RegExp>`. See
[filters](/docs/routing#filters) for how each form matches, including the `*` wildcard.

**Only a `custom` reaches the log events and the account owner.** It is handed the full decoded
data, so it is where you match on `logEvents`, `logStream` or `owner`, which no dedicated key covers.
See [`custom`](/docs/routing#custom) for where it sits in the filter order.

## Handler

Handlers take one argument and return nothing.

```ts
import { logger } from '@lambda-event-router/base'
import type { CloudWatchLogsRequest } from '@lambda-event-router/cloudwatch'

export async function processLogs(request: CloudWatchLogsRequest): Promise<void> {
  logger.info(`${request.logEvents.length} events from ${request.logGroup}`)
}
```

### Request object

The request is the decoded log data plus the raw event and the Lambda context.

| Field | Type | Description |
| --- | --- | --- |
| `logEvents` | `CloudWatchLogsLogEvent[]` | The decoded log events, each with `id`, `timestamp` and `message` |
| `logGroup` | `string` | The log group the events came from |
| `logStream` | `string` | The log stream within that group |
| `subscriptionFilters` | `string[]` | The subscription filter names that matched this delivery |
| `messageType` | `string` | `DATA_MESSAGE` for log data, `CONTROL_MESSAGE` for the reachability check |
| `owner` | `string` | The AWS account ID the log group belongs to |
| `event` | `CloudWatchLogsEvent` | The untouched event from AWS, holding the still-encoded `awslogs.data` |
| `context` | `Context` | The Lambda context |

`CloudWatchLogsEvent`, `CloudWatchLogsLogEvent` and `Context` come from `aws-lambda`, not from this
package.

### Response type

Handlers return `Promise<void>`. A log delivery has nothing useful to send back, so the router hands
nothing to Lambda. There is no `CloudWatchLogsResponse` type; the handler signature returns
`Promise<void>` directly.

Throwing is how you signal failure. See [Failures and retries](#failures-and-retries) for what that
does.

### Inferred handlers

This router has no schemas, so inference is not about typing a body. `defineRoute` hands your handler
a fully typed `CloudWatchLogsRequest` without you importing or naming it.

```ts
import { logger } from '@lambda-event-router/base'
import { defineRoute } from '@lambda-event-router/cloudwatch'

export const processLogsRoute = defineRoute({
  filters: { logGroup: '/aws/lambda/my-function', messageType: 'DATA_MESSAGE' },
}).handle(async ({ logGroup, logStream, logEvents }) => {
  logger.info(`${logEvents.length} events from ${logGroup}/${logStream}`)
})

cloudWatchLogsRouter.route(processLogsRoute)
```

Not knowing the request shape pays off most in a Lambda taking several event sources, since you never
have to look any of them up. See [inferred handlers](/docs/handlers#inferred-handlers), where the same
source is written both ways to compare.

### Annotated handlers

Annotating the request yourself splits route setup from business logic. The request type takes no
generic parameters, so the annotation is just [`CloudWatchLogsRequest`](#types).

```ts
// handlers/processLogs.ts
import { logger } from '@lambda-event-router/base'
import type { CloudWatchLogsRequest } from '@lambda-event-router/cloudwatch'

export async function processLogs(request: CloudWatchLogsRequest): Promise<void> {
  logger.info(`${request.logEvents.length} events from ${request.logGroup}`)
}
```

```ts
// cloudwatch.ts
import { createCloudWatchLogsRouter } from '@lambda-event-router/cloudwatch'
import { processLogs } from './handlers/processLogs'

const cloudWatchLogsRouter = createCloudWatchLogsRouter()

cloudWatchLogsRouter.dataMessage({
  filters: { logGroup: '/aws/lambda/my-function' },
  handler: processLogs,
})
```

With no schema and no generic parameters, an annotated handler receives exactly what an inferred one
does, and the same function assigns through `route()`, `dataMessage()` and `controlMessage()` alike.
See [annotated handlers](/docs/handlers#annotated-handlers) for the worked version.

## Failures and retries

A delivery that matches no route throws `No route matched for log group <name>`, and a handler that
throws propagates the error out of the Lambda. There is no batch here, one event carries one
delivery, so there is no partial reporting to configure.

A subscription filter invokes your function asynchronously, so Lambda applies its usual async retry
and on-failure destination to a delivery that throws. Throwing is the only signal you have, since
there is no return value the subscription reads.

## Middleware

Router and route middleware are both typed `CloudWatchLogsMiddleware`, and the chain runs once per
delivery.

```ts
import { logger } from '@lambda-event-router/base'
import type { CloudWatchLogsMiddleware } from '@lambda-event-router/cloudwatch'

export const logInvocation: CloudWatchLogsMiddleware = async (request, next) => {
  logger.info(`Handling delivery from ${request.logGroup}`)
  return next(request)
}
```

```ts
const cloudWatchLogsRouter = createCloudWatchLogsRouter({ middleware: [logInvocation] })

cloudWatchLogsRouter.route({
  filters: { logGroup: '/aws/lambda/my-function' },
  middleware: [withRequestContext],
  handler: processLogs,
})
```

See [middleware](/docs/middleware) for the execution order and the three levels it attaches at.

## Types

All exported from `@lambda-event-router/cloudwatch`.

| Type | Description |
| --- | --- |
| `CloudWatchLogsRequest` | The handler argument |
| `CloudWatchLogsFilters` | The `filters` object |
| `CloudWatchLogsEventFilters` | The filters without `messageType`, taken by `dataMessage()` and `controlMessage()` |
| `CloudWatchLogsMessageType` | `'DATA_MESSAGE' \| 'CONTROL_MESSAGE'` |
| `CloudWatchLogsMiddleware` | Router and route middleware |
| `CloudWatchLogsRouteDefinition` | A full route passed to `route()` |
| `CloudWatchLogsDataMessageRouteDefinition` | A route passed to `dataMessage()` |
| `CloudWatchLogsControlMessageRouteDefinition` | A route passed to `controlMessage()` |
| `CloudWatchLogsRouterOptions` | Options for `createCloudWatchLogsRouter` |

The `CloudWatchLogsRouter` class and the `createCloudWatchLogsRouter` and `defineRoute` functions come
from the same place.

No type on this router takes a generic parameter. The request, filters and middleware are fixed,
since the decoded log shape is the same for every delivery, so a reader arriving from a router like
SQS will find no generic parameters to pass here.

## Code example

One Lambda subscribed to a couple of log group patterns, splitting Lambda logs, ECS logs and the
subscription's control message across three handlers.

Open a file: [index.ts](#cloudwatch-example:index.ts) | [CloudWatch router](#cloudwatch-example:cloudwatch.ts) | [handlers](#cloudwatch-example:handlers/logs.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { cloudWatchLogsRouter } from './cloudwatch.js'

const lambdaRouter = new LambdaRouter({
  routers: [cloudWatchLogsRouter],
})

export const handler: Handler = lambdaRouter.handler()`,
  },
  {
    path: 'cloudwatch.ts',
    code: `import { createCloudWatchLogsRouter } from '@lambda-event-router/cloudwatch'

import { handleControlMessage, handleEcsLogs, handleLambdaLogs } from './handlers/logs.js'

export const cloudWatchLogsRouter = createCloudWatchLogsRouter()

cloudWatchLogsRouter
  .dataMessage({
    filters: { logGroup: '/aws/lambda/*' },
    handler: handleLambdaLogs,
  })
  .dataMessage({
    filters: { logGroup: '/aws/ecs/*' },
    handler: handleEcsLogs,
  })
  .controlMessage({
    filters: {},
    handler: handleControlMessage,
  })`,
  },
  {
    path: 'handlers/logs.ts',
    code: `import { logger } from '@lambda-event-router/base'
import type { CloudWatchLogsRequest } from '@lambda-event-router/cloudwatch'

export async function handleLambdaLogs({ logGroup, logEvents }: CloudWatchLogsRequest): Promise<void> {
  logger.info(\`\${logEvents.length} Lambda log events from \${logGroup}\`)
}

export async function handleEcsLogs({ logGroup, logEvents }: CloudWatchLogsRequest): Promise<void> {
  logger.info(\`\${logEvents.length} ECS log events from \${logGroup}\`)
}

export async function handleControlMessage({ logGroup }: CloudWatchLogsRequest): Promise<void> {
  logger.info(\`Subscription reachable for \${logGroup}\`)
}`,
  },
]
</script>

<CodeFileViewer :files="files" id="cloudwatch-example" default-file="cloudwatch.ts" line-numbers collapse-toggle fixed-height />

The two data routes match different log group patterns and the control route matches a different
message type, so no delivery can match two and the order you register them in makes no difference. A
subscription only delivers from the log groups you attach it to, so these three routes cover every
delivery the function can receive.

`index.ts` hands the router to `LambdaRouter`, which is what AWS invokes and what every router in the
Lambda gets registered on. See [routers](/docs/routers) for how the two levels of matching fit
together.
