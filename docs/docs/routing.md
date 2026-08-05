# Routing

Routing is how an event or a record reaches one of your handlers. By the time it starts, `LambdaRouter`
has already worked out which router owns the event, so everything on this page happens inside a single
router. See [routers](/docs/routers) for that first step.

## Registering routes

`route()` exists on every router and takes `filters` and a `handler`, plus whatever schema keys and
`middleware` that router supports. It returns the router, so registrations chain.

### Inferred and annotated handlers

You can build a route with `defineRoute` or pass a plain route object. Both end up as the same
registered route, and the difference is where the handler's types come from: `defineRoute` infers them
from your schemas, while a route object leaves you to name them. See
[handlers](/docs/handlers#inferred-handlers) for how each plays out across files.

Some packages holding more than one router name it after the router instead, so
`defineWebSocketRoute`, `defineActiveMQRoute` and `defineRabbitMQRoute`. `base` calls it
`defineEventRoute`.

::: code-group

```ts [Inferred]
import { defineRoute } from '@lambda-event-router/sqs'

import { OrderSchema } from '../schemas/order.js'

export const processOrderRoute = defineRoute({
  filters: { eventSourceArn: ORDER_QUEUE_ARN, messageAttributes: { type: 'OrderPlaced' } },
  bodySchema: OrderSchema,
}).handle(async ({ body }) => {
  await orders.save(body) // body is typed from OrderSchema, with nothing to declare
})

sqsRouter.route(processOrderRoute).route(cancelOrderRoute)
```

```ts [Annotated]
import { createSQSRouter } from '@lambda-event-router/sqs'

import { cancelOrder } from './handlers/cancelOrder.js'
import { processOrder } from './handlers/processOrder.js'
import { OrderSchema } from './schemas/order.js'

export const sqsRouter = createSQSRouter({ batchItemFailures: true })

sqsRouter.route({
  filters: {
    eventSourceArn: ORDER_QUEUE_ARN,
    messageAttributes: { type: 'OrderPlaced' }
  },
  bodySchema: OrderSchema,
  handler: processOrder, // Types named in its own file
})

sqsRouter.route({
  filters: {
    eventSourceArn: ORDER_QUEUE_ARN,
    messageAttributes: { type: 'OrderCancelled' }
  },
  bodySchema: OrderSchema,
  handler: cancelOrder,
})
```

:::

### Convenience methods

Some routers add methods on top of `route()` for the filter you would set every time anyway. They take
everything else exactly as `route()` does, so each pair below registers the same route.

::: code-group

```ts [DynamoDB Streams]
// insert() sets eventName, so these two are the same route
dynamoRouter.insert({
  filters: {
    eventSourceArn: ORDER_TABLE_STREAM_ARN
  },
  handler: onOrderInserted
})

dynamoRouter.route({
  filters: {
    eventName: 'INSERT',
    eventSourceArn: ORDER_TABLE_STREAM_ARN
  },
  handler: onOrderInserted,
})
```

```ts [API Gateway]
// get() sets method, so these two are the same route
apiGatewayRouter.get({
  filters: {
    path: '/orders/:orderId'
  },
  handler: getOrder
})

apiGatewayRouter.route({
  filters: {
    method: 'GET',
    path: '/orders/:orderId'
  },
  handler: getOrder
})
```

:::

The filter a method fills in is dropped from the type it accepts, so `insert()` will not let you pass
an `eventName` that contradicts it. `route()` never goes away, so a convenience method is always
something you can ignore.

## Filters

`filters` says what an event has to look like for the route to take it. The keys come from the event
source, so SQS gives you `eventSourceArn` and `messageAttributes` while EventBridge gives you `source`
and `detailType`. Each [router page](/packages) lists its own.

- Every key you set has to match. Keys are ANDed, and two different keys cannot be ORed
- An array at a single key is an OR, so `eventSourceArn: [ORDER_QUEUE_ARN, ORDER_DLQ_ARN]` takes either
- Missing data is a miss rather than a pass, so a `messageAttributes` key the message does not carry
  fails the filter
- An empty string is a filter nothing matches, so leave a key off rather than setting it to `''`
- String keys take `FilterStringMatcher` from base, which is `string | RegExp | Array<string | RegExp>`
- A plain string has to match the whole value, with `*` as its one wildcard
- Every other character is literal, so the `?` and `.` in `report?.csv` match those characters alone
- A `RegExp` is used exactly as you wrote it, anchors and all
- Not everything is compared as a string. SQS `Number` message attributes compare as numbers, and
  DynamoDB partition and sort keys take numbers too

::: code-group

```ts [SQS]
sqsRouter.route({
  filters: {
    eventSourceArn: 'arn:aws:sqs:eu-west-1:*:orders-*', // * is the wildcard, and the rest is literal
    messageAttributes: {
      type: ['OrderPlaced', 'OrderUpdated'], // Either value at this one key
      source: /^(web|mobile)$/, // Used as written
      schemaVersion: 2, // A Number attribute, compared as a number
    },
  },
  bodySchema: OrderSchema,
  handler: processOrder,
})
```

```ts [API Gateway]
// method and path are required, and path is a pattern rather than a matcher
apiGatewayRouter.route({
  filters: {
    method: 'GET',
    path: '/customers/:customerId/orders/:orderId',
  },
  handler: getCustomerOrder,
})

// request.path is typed as { customerId: string; orderId: string }
```

:::

**The HTTP routers are the exception to all of the above.** `method` and `path` are required rather
than optional, `path` is a path pattern rather than a `FilterStringMatcher`, and a request that
matches no route gets a 404 instead of throwing.

### custom

Every filters object takes a `custom` for anything the built in keys cannot express. It is a
function, sync or async, and it receives that router's `<Source>FilterInput`, so an SQS one is given
`{ body, messageAttributes, record }`.

It runs after the other filters on its own route, so the cheap comparisons have already ruled out
anything they can before it is called.

**`custom` is given data that no schema has validated.** Filtering is what picks the route and
the route is what carries the schemas, so validation cannot have run yet. Treat the body as `unknown`
and narrow it, because the types will not stop you reading straight into it.

```ts
import { isObject } from '@lambda-event-router/base'
import { defineRoute, type SQSFilterInput } from '@lambda-event-router/sqs'

import { OrderSchema } from '../schemas/order.js'

// body is unknown here, so narrow it before reading anything off it
const isHighValue = ({ body }: SQSFilterInput): boolean => {
  if (!isObject(body) || typeof body.total !== 'number') return false

  return body.total >= HIGH_VALUE_THRESHOLD
}

export const highValueOrderRoute = defineRoute({
  filters: { eventSourceArn: ORDER_QUEUE_ARN, custom: isHighValue },
  bodySchema: OrderSchema,
}).handle(async ({ body }) => {
  await orders.escalate(body) // body.total is a number, because the schema has run by now
})
```

## Match order

Routes are ranked by specificity before matching. If one route matches only a subset of another, it is
tried first, regardless of registration order.

```ts
// Broader: matches everything the route below matches, and more
sqsRouter.route({
  filters: {
    eventSourceArn: ORDER_QUEUE_ARN
  },
  handler: processOrder,
})

// Narrower: same queue, plus a message attribute
sqsRouter.route({
  filters: {
    eventSourceArn: ORDER_QUEUE_ARN,
    messageAttributes: { type: 'OrderCancelled' }
  },
  handler: cancelOrder,
})
```

Ranking comes from the filters alone. **Every key in the broader route must be covered**, so filters are
compared as one test:

- A filters object with fewer keys is broader, since a key you leave off is one you do not constrain.
  `filters: {}` constrains nothing at all, so it is the broadest route you can write
- An exact value beats a pattern matching it, so `orders-2024` is tried before `orders-*`
- A pattern beats a longer pattern of the same shape, so `orders-*` is tried before `orders-2024-*`,
  and `*` on its own is broader than every other matcher
- A single value beats a list holding it, so `'INSERT'` is tried before `['INSERT', 'MODIFY']`
- A `custom` can only reject an event, never accept an extra one, so a route carrying one is tried
  before the same route without it. A guarded route beats its own fallback

If neither route covers the other, **registration order is preserved**. This includes filters that
disagree on keys, most `RegExp` pairs, incompatible patterns and a `custom` on the broader route.
Identical filters also stay in registration order. Nothing else moves either: a route is only lifted past
a route it is provably narrower than.

**Ranking is based on what filters could exclude, not your actual traffic.** A key that is always present
still counts, so `{ tenant: '*', type: 'Order' }` ranks ahead of `{ type: 'Order' }` even if they
currently match the same events. Prefer mutually exclusive filters, such as distinct message attributes
or detail types, to avoid relying on ranking.

**Check the router page before relying on order.** First-match behaviour is router-specific. CodeCommit
runs every matching route, so it is not ranked at all.

HTTP routers (API Gateway, ALB, VPC Lattice) rank paths instead. Literal segments beat params at the same
position, left to right: `/orders/latest` beats `/orders/:orderId`, and `/a/:x` beats `/:y/b` for `/a/b`.
A segment that mixes literal text with a param, like `:name.json`, ranks between a literal and a bare param.
A `custom` also beats the same path without one. Identical paths use registration order.

**The difference is that paths are ordered; filter objects aren't.** HTTP routers can therefore resolve
overlaps that filter routers leave alone, because a filters object has no leftmost key to appeal to when
`source` and `detailType` disagree.

### Nothing matched

Matching nothing is an error, and the cost depends on the router.

| Router | An event or record matching no route |
| --- | --- |
| Record based | Throws, which fails the whole batch unless the router reports per record failures |
| HTTP | Returns a 404 |

So with SQS `batchItemFailures` off, one record matching no route takes down every record in the batch
that would have succeeded.

Where you cannot enumerate everything that might arrive, a catch-all route filtering only on the
source gives you somewhere to put it.

## Schema validation

Routers validate parts of an event against a schema you set on the route. The keys are per router, so
SQS takes `bodySchema` and `messageAttributesSchema` while DynamoDB Streams takes `keysSchema`,
`newImageSchema` and `oldImageSchema`.

Any [Standard Schema](https://standardschema.dev) library works, so Zod, Valibot and ArkType all fit
with nothing to adapt.

An HTTP route taking bytes rather than JSON sets its `bodySchema` to `BinaryBody`, which the HTTP
routers export. See [binary bodies](/routers/ALBRouter#binary-bodies).

```ts
sqsRouter.route({
  filters: { eventSourceArn: ORDER_QUEUE_ARN },
  bodySchema: OrderSchema,
  messageAttributesSchema: z.object({ dryRun: z.coerce.boolean().default(false) }),
  handler: processOrder,
})
```

Validation runs after a route has matched. An event that matches a route and then fails its schema is
an error rather than something that falls through to the next route, so two routes cannot be told
apart by their schemas alone.

### Validation failures

| Router | A failing schema |
| --- | --- |
| Record based | Throws, and the record counts as a failure |
| HTTP `querySchema` | 400, with the validation issues in the body |
| HTTP `bodySchema` | 422, with the validation issues in the body |
| HTTP `responseSchema` | 500, with the issues logged rather than returned |

Your handler is given the validated output rather than what arrived, so a `z.coerce.boolean()` reaches
it as a `boolean`. See [handlers](/docs/handlers#requests).
