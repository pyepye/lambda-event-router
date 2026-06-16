# EventBridgeRouter

`EventBridgeRouter` routes a single EventBridge event to a handler by its source and detail type.

Every event arrives in the same envelope, whether you published it onto a bus, it came out of a Pipe
or an EventBridge Rule delivered it. The router reads the envelope, works out which of your routes
should handle it by source, detail type, account, Region or resource, then hands your handler the
`detail` payload. It also reaches services that cannot trigger Lambda at all, by way of CloudTrail,
which routes and types exactly like an event you sent yourself.

EventBridge Scheduler is the exception. It delivers whatever payload you configured rather than an
EventBridge envelope, so use [`EventRouter`](/routers/EventRouter) for those.

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/eventbridge
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports
`LambdaRouter`, which every router plugs into.

## Create the router

```ts
import { createEventBridgeRouter } from '@lambda-event-router/eventbridge'
import { logInvocation } from './middleware/logInvocation'

const eventBridgeRouter = createEventBridgeRouter({
  middleware: [logInvocation],  // Optional
})
```

`middleware` is the only option and it can be left out. `createEventBridgeRouter()` on its own gives
you a router with no shared middleware.

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `middleware` | `EventBridgeMiddleware[]` | No | `[]` | Runs for every event this router handles, before any route middleware. See [Middleware](#middleware) |

## Register routes

```ts
eventBridgeRouter.route({
  filters: {
    source: 'myapp.orders',
    detailType: 'Order Created',
  },
  detailSchema: OrderSchema,  // Optional
  middleware: [withOrderContext],  // Optional
  handler: processOrder,
})
```

`filters` and `handler` are the only required keys, though `filters` can be an empty object to match
every event.

`route()` returns the router, so you can chain registrations.

```ts
eventBridgeRouter.route(orderCreatedRoute).route(ec2StateChangeRoute)
```

Routes match in registration order and the first match wins, so give each route filters no other
route can match. Matching on `source` and `detailType` together does that, since no two kinds of
event share both. See [match order](/docs/routing#match-order) for what goes wrong when they overlap.

The `detail` payload is `unknown` until you type it, either with a schema or from the source and
detail type of a known AWS event. See [Typed detail](#typed-detail) for both.

**An event that matches no route throws**, which fails the invocation. Register a route with empty
`filters` as a catch-all if you would rather swallow events you do not recognise, and see [nothing
matched](/docs/routing#nothing-matched) for what the other routers do instead.

## Filters

Every filter key on one route, showing each form a value can take. All of them are optional, so set
the ones that pick out the events you want and leave the rest off.

```ts
eventBridgeRouter.route({
  filters: {
    source: 'myapp.orders', // Or an array, or a pattern: /^myapp\./
    detailType: ['Order Created', 'Order Updated'],
    account: '123456789012',
    region: 'eu-west-2',
    resource: 'arn:aws:events:eu-west-2:123456789012:event-bus/orders',
    custom: ({ detail }) => {
      // Only a custom reaches the detail payload or the raw envelope
      if (!isObject(detail)) return false

      return detail.priority === 'high'
    },
  },
  handler: processOrder,
})
```

| Filter | Type | Description |
| --- | --- | --- |
| `source` | `FilterStringMatcher` | Matches the event's `source` |
| `detailType` | `FilterStringMatcher` | Matches the event's `detail-type` |
| `account` | `FilterStringMatcher` | Matches the AWS account ID the event came from |
| `region` | `FilterStringMatcher` | Matches the AWS Region the event came from |
| `resource` | `FilterStringMatcher` | Matches when any ARN in the event's `resources` array matches |
| `custom` | `(input: EventBridgeFilterInput) => boolean \| Promise<boolean>` | Anything the other filters cannot express. Can be async |

`FilterStringMatcher` is `string | RegExp | Array<string | RegExp>`. See
[filters](/docs/routing#filters) for how each form matches, including the `*` wildcard.

**Only a `custom` reaches the `detail` payload and the raw envelope.** The `detail` it is given
is unvalidated and typed `unknown`, so narrow it with `isObject` from `@lambda-event-router/base`
before reading into it. See [`custom`](/docs/routing#custom) for where it sits in the
filter order.

## Handler

Handlers take one argument and return nothing.

```ts
import { logger } from '@lambda-event-router/base'
import type { EventBridgeRequest } from '@lambda-event-router/eventbridge'

export async function processOrder(request: EventBridgeRequest<Order>): Promise<void> {
  logger.info(`Processing order ${request.detail.orderId} for ${request.detail.total}`)
}
```

### Request object

The request is the envelope pulled apart into its fields, plus the raw event and the Lambda context.

| Field | Type | Description |
| --- | --- | --- |
| `source` | `string` | The service or app that published the event |
| `detailType` | `string` | The event's `detail-type`, naming what happened |
| `detail` | `TDetail` | The event payload. `unknown` until you type it, see [Typed detail](#typed-detail) |
| `account` | `string` | The AWS account ID the event came from |
| `region` | `string` | The AWS Region the event came from |
| `time` | `string` | The event timestamp, ISO 8601 |
| `resources` | `string[]` | ARNs of the resources the event concerns |
| `id` | `string` | The unique event ID |
| `event` | `EventBridgeEventEnvelope<TDetail>` | The untouched event from AWS, keeping `detail-type` hyphenated as AWS sends it |
| `context` | `Context` | The Lambda context |

`EventBridgeEventEnvelope` comes from this package. `Context` comes from `aws-lambda`.

### Response type

Handlers return `Promise<void>`. An EventBridge event has nothing useful to send back, so the router
hands nothing to Lambda. There is no `EventBridgeResponse` type; the handler signature returns
`Promise<void>` directly.

Throwing is how you signal failure. See [Failures and retries](#failures-and-retries) for what that
does.

### Inferred handlers

`defineRoute` reads the schema, or the source and detail type of a known AWS event, and hands your
handler a fully typed `detail` without you naming it. Below, `detail.orderId` is a `string` because
`OrderSchema` says so.

```ts
import { logger } from '@lambda-event-router/base'
import { defineRoute } from '@lambda-event-router/eventbridge'
import { z } from 'zod'

const OrderSchema = z.object({ orderId: z.string(), total: z.number() })

export const orderCreatedRoute = defineRoute({
  filters: { source: 'myapp.orders', detailType: 'Order Created' },
  detailSchema: OrderSchema,
}).handle(async ({ detail }) => {
  logger.info(`Processing order ${detail.orderId} for ${detail.total}`)
})

eventBridgeRouter.route(orderCreatedRoute)
```

For a known AWS event, `defineRoute` types `detail` from the source and detail type with no schema at
all, which is [Typed detail](#typed-detail). Inference pays off most in a Lambda taking several event
sources, since you never have to know any of their request shapes. See [inferred
handlers](/docs/handlers#inferred-handlers), where the same source is written both ways to compare.

### Annotated handlers

Annotating the request yourself splits route setup from business logic, using
[`EventBridgeRequest`](#generic-parameters) and your own type for the detail.

```ts
// handlers/processOrder.ts
import { logger } from '@lambda-event-router/base'
import type { EventBridgeRequest } from '@lambda-event-router/eventbridge'
import { z } from 'zod'

export const OrderSchema = z.object({ orderId: z.string(), total: z.number() })
type Order = z.infer<typeof OrderSchema>

export async function processOrder({ detail }: EventBridgeRequest<Order>): Promise<void> {
  logger.info(`Processing order ${detail.orderId}`)
}
```

```ts
// eventbridge.ts
import { createEventBridgeRouter } from '@lambda-event-router/eventbridge'
import { OrderSchema, processOrder } from './handlers/processOrder'

const eventBridgeRouter = createEventBridgeRouter()

eventBridgeRouter.route({
  filters: { source: 'myapp.orders', detailType: 'Order Created' },
  detailSchema: OrderSchema,
  handler: processOrder,
})
```

Derive the type from the schema with `z.infer` rather than hand-writing an interface that mirrors it.
The automatic typing for known AWS events only happens through `defineRoute`, so annotate a known
event yourself here, `EventBridgeRequest<EC2StateChangeDetail>` for an EC2 state change. See
[annotated handlers](/docs/handlers#annotated-handlers) for the worked version.

## Schema validation

`detailSchema` is the only schema key and it is optional. It validates the event's `detail` payload
and types it for the handler.

```ts
const OrderSchema = z.object({
  orderId: z.string(),
  total: z.number(),
})

eventBridgeRouter.route({
  filters: { source: 'myapp.orders', detailType: 'Order Created' },
  detailSchema: OrderSchema,
  handler: processOrder,
})
```

| Key | Validates |
| --- | --- |
| `detailSchema` | The event's `detail` payload |

Any [Standard Schema](https://standardschema.dev) library works. Validation runs after a route has
matched, so an event failing its schema throws rather than falling through to the next route. Because
a route matches on `source` and `detailType` first, and those pin down what `detail` looks like,
splitting your routes by detail type keeps each schema matched to one payload. See [schema
validation](/docs/routing#schema-validation) for what your handler receives after coercion.

## Typed detail

`detail` arrives as `unknown`, since EventBridge carries events from any source. You type it in one of
two ways.

The first is a [`detailSchema`](#schema-validation), which validates at runtime and types the handler
from the schema output.

The second needs no schema. For a known AWS event, `defineRoute` reads the `source` and `detailType`
and looks them up in `EventBridgeDetailTypeMap`, typing `detail` for you.

```ts
import { logger } from '@lambda-event-router/base'
import { defineRoute } from '@lambda-event-router/eventbridge'

// detail is EC2StateChangeDetail, no schema needed
export const ec2StateChangeRoute = defineRoute({
  filters: { source: 'aws.ec2', detailType: 'EC2 Instance State-change Notification' },
}).handle(async ({ detail }) => {
  logger.info(`Instance ${detail['instance-id']} is now ${detail.state}`)
})
```

The map ships with entries for common AWS events.

| `source` | `detailType` | `detail` typed as |
| --- | --- | --- |
| `aws.ec2` | `EC2 Instance State-change Notification` | `EC2StateChangeDetail` |
| `aws.s3` | `Object Created`, `Object Deleted`, `Object Restore Initiated`, `Object Restore Completed` | The matching S3 notification detail from `aws-lambda` |
| `aws.events` | `Scheduled Event` | `ScheduledEventDetail`, an empty object |

Add your own events to the map with module augmentation, and `defineRoute` types them the same way.

```ts
declare module '@lambda-event-router/eventbridge' {
  interface EventBridgeDetailTypeMap {
    'myapp.orders': {
      'Order Created': { orderId: string; total: number }
    }
  }
}
```

Setting a `detailSchema` overrides the map, since the schema validates as well as types. The map
lookup only runs through `defineRoute`. Through `route()` and an annotated handler, `detail` comes
from the `detailSchema` or the `EventBridgeRequest<...>` annotation, so name the type yourself there.

## Failures and retries

An event that matches no route throws an error naming the unmatched source and detail type, and an
event whose `detail` fails its schema throws a schema validation error naming the event ID. Both fail
the invocation. Middleware does not run when validation fails.

One event is one invocation, so there is no batch here and no partial reporting to configure.

How a throw is retried depends on how the event reached you. A Rule target invokes Lambda
asynchronously, so Lambda's usual async retry and on-failure destination apply. A Pipe retries per its
own configuration. Throwing is the only failure signal you have, since the router returns nothing.

## Middleware

Router and route middleware are both typed `EventBridgeMiddleware`, and the chain runs once per event.

```ts
import { logger } from '@lambda-event-router/base'
import type { EventBridgeMiddleware } from '@lambda-event-router/eventbridge'

export const logInvocation: EventBridgeMiddleware = async (request, next) => {
  logger.info(`Handling ${request.source} / ${request.detailType}`)
  return next(request)
}
```

```ts
const eventBridgeRouter = createEventBridgeRouter({ middleware: [logInvocation] })

eventBridgeRouter.route({
  filters: { source: 'myapp.orders', detailType: 'Order Created' },
  middleware: [withOrderContext],
  handler: processOrder,
})
```

**Route middleware carries the route's detail type.** A route with a `detailSchema` needs
`EventBridgeMiddleware<Order>`. A `source` and `detailType` pair from the detail type map sets that
type too. `EventBridgeMiddleware` on its own does not compile on either route. Router middleware takes
no type argument, because it runs for every route.

See [middleware](/docs/middleware) for the execution order and the three levels it attaches at.

## Types

All exported from `@lambda-event-router/eventbridge`.

| Type | Description |
| --- | --- |
| `EventBridgeRequest<TDetail>` | The handler argument |
| `EventBridgeHandler<TDetail>` | The handler function, returning `Promise<void>` |
| `EventBridgeFilters` | The `filters` object |
| `EventBridgeFilterInput` | What `custom` receives |
| `EventBridgeRouteDefinition<TDetail>` | A full route passed to `route()` |
| `EventBridgeRouterOptions` | Options for `createEventBridgeRouter` |
| `EventBridgeMiddleware<TDetail>` | Router and route middleware |
| `EventBridgeEventEnvelope<TDetail>` | The raw event, as `request.event` |
| `EventBridgeDetailTypeMap` | The source to detail type map you augment for your own events |
| `EC2StateChangeDetail` | The `detail` for an EC2 state change |
| `ScheduledEventDetail` | The `detail` for a scheduled rule, an empty object |

The `EventBridgeRouter` class and the `createEventBridgeRouter` and `defineRoute` functions come from
the same place.

### Generic parameters

The types above that take a parameter all take the same one.

| Parameter | Types | Default |
| --- | --- | --- |
| `TDetail` | `request.detail` | `unknown` |

Leave it off and `detail` is `unknown`, which is what you get for an event you have not typed. You
only need to pass it for [annotated handlers](#annotated-handlers); inference and the detail type map
cover the rest.

## Code example

One Lambda handling a custom order event with a schema, an EC2 state change typed from the detail map
and a scheduled rule, each matched on a distinct source and detail type.

Open a file: [index.ts](#eventbridge-example:index.ts) | [EventBridge router](#eventbridge-example:eventbridge.ts) | [handlers](#eventbridge-example:handlers/events.ts) | [schema](#eventbridge-example:schemas/order.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { eventBridgeRouter } from './eventbridge.js'

const lambdaRouter = new LambdaRouter({
  routers: [eventBridgeRouter],
})

export const handler: Handler = lambdaRouter.handler()`,
  },
  {
    path: 'eventbridge.ts',
    code: `import { createEventBridgeRouter } from '@lambda-event-router/eventbridge'

import { handleEc2StateChange, handleScheduledRule, processOrder } from './handlers/events.js'
import { OrderSchema } from './schemas/order.js'

export const eventBridgeRouter = createEventBridgeRouter()

eventBridgeRouter
  .route({
    filters: { source: 'myapp.orders', detailType: 'Order Created' },
    detailSchema: OrderSchema,
    handler: processOrder,
  })
  .route({
    filters: { source: 'aws.ec2', detailType: 'EC2 Instance State-change Notification' },
    handler: handleEc2StateChange,
  })
  .route({
    filters: { source: 'aws.events', detailType: 'Scheduled Event' },
    handler: handleScheduledRule,
  })`,
  },
  {
    path: 'handlers/events.ts',
    code: `import { logger } from '@lambda-event-router/base'
import type { EC2StateChangeDetail, EventBridgeRequest, ScheduledEventDetail } from '@lambda-event-router/eventbridge'

import type { Order } from '../schemas/order.js'

export async function processOrder({ detail }: EventBridgeRequest<Order>): Promise<void> {
  logger.info(\`Processing order \${detail.orderId} for \${detail.total}\`)
}

export async function handleEc2StateChange({ detail }: EventBridgeRequest<EC2StateChangeDetail>): Promise<void> {
  logger.info(\`Instance \${detail['instance-id']} is now \${detail.state}\`)
}

export async function handleScheduledRule({ time, resources }: EventBridgeRequest<ScheduledEventDetail>): Promise<void> {
  logger.info(\`Scheduled rule \${resources[0]} fired at \${time}\`)
}`,
  },
  {
    path: 'schemas/order.ts',
    code: `import { z } from 'zod'

export const OrderSchema = z.object({
  orderId: z.string(),
  total: z.number(),
})

export type Order = z.infer<typeof OrderSchema>`,
  },
]
</script>

<CodeFileViewer :files="files" id="eventbridge-example" default-file="eventbridge.ts" line-numbers collapse-toggle fixed-height />

Each route matches a different source and detail type, so no event can match two and the order you
register them in makes no difference. The EC2 and scheduled routes need no schema, since their detail
is typed from the [detail map](#typed-detail).

`index.ts` hands the router to `LambdaRouter`, which is what AWS invokes and what every router in the
Lambda gets registered on. See [routers](/docs/routers) for how the two levels of matching fit
together.
