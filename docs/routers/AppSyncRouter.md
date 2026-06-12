# AppSyncRouter

`AppSyncRouter` routes AWS AppSync resolver invocations to handlers, one GraphQL field at a time.

AppSync calls your function to resolve a single field, and the router picks a route from the type and
field names on the event. Your handler is given that field's arguments along with whoever the caller
was authorised as, and what it returns becomes the value of the field.

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/appsync
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports
`LambdaRouter`, which every router plugs into.

## Create the router

```ts
import { createAppSyncRouter } from '@lambda-event-router/appsync'

import { withResolverContext } from './middleware/withResolverContext'

const appSyncRouter = createAppSyncRouter({
  middleware: [withResolverContext],  // Optional
})
```

`middleware` is the only option, so `createAppSyncRouter()` on its own gives you a router with nothing
attached to it.

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `middleware` | `AppSyncResolverMiddleware[]` | No | `[]` | Runs for every field this router resolves, before any route middleware. See [Middleware](#middleware) |

## Register routes

```ts
appSyncRouter.route({
  filters: {
    parentTypeName: 'Mutation',
    fieldName: 'createOrder',
  },
  argumentsSchema: CreateOrderSchema,  // Optional
  middleware: [withOrderContext],  // Optional
  handler: createOrder,
})
```

`filters` and `handler` are the only required keys.

`route()` returns the router, so you can chain registrations.

```ts
appSyncRouter.route(getOrderRoute).route(createOrderRoute)
```

Routes match in registration order and the first match wins, so give each route filters no other route
can match. See [match order](/docs/routing#match-order) for what goes wrong when they overlap.

**A field that matches no route throws `No route matched for Mutation.createOrder`.** AppSync turns a
failed invocation into an error on the field, so the client gets `null` for it and an entry in
`errors`. See [nothing matched](/docs/routing#nothing-matched) for what the other routers do instead.

**A batching resolver never reaches this router.** With `maxBatchSize` set, AppSync sends an array of
events rather than one, which `canHandleEvent` refuses. `LambdaRouter` then has nothing to hand it to
and throws `No router found for event`. Leave batching off on any resolver pointing at a Lambda you
route with this.

### Convenience methods

`query()`, `mutation()` and `subscription()` fill in the `parentTypeName` filter and take the field
name at the top level rather than inside `filters`.

```ts
// Both of these register the same route
appSyncRouter.query({
  fieldName: 'getOrder',
  handler: getOrder,
})

appSyncRouter.route({
  filters: { parentTypeName: 'Query', fieldName: 'getOrder' },
  handler: getOrder,
})
```

| Method | Sets |
| --- | --- |
| `query()` | `parentTypeName: 'Query'` |
| `mutation()` | `parentTypeName: 'Mutation'` |
| `subscription()` | `parentTypeName: 'Subscription'` |

All three take `argumentsSchema`, `middleware` and `handler` exactly as `route()` does. What they drop
is the rest of the filters: `custom` is the only key left, and `fieldName` moves out to become a
plain string rather than a `FilterStringMatcher`. A route covering several fields, a whole type or a
[nested field](#nested-field-resolvers) wants `route()`. See [convenience
methods](/docs/routing#convenience-methods) for how the other routers use them.

AppSync runs a `Subscription` field's resolver when a client subscribes rather than for each message
published afterwards, so a `subscription()` route decides who may connect.

## Filters

Every filter key on one route, showing each form a value can take. All of them are optional, so set the
ones that pick out the fields you want and leave the rest off.

```ts
appSyncRouter.route({
  filters: {
    parentTypeName: 'Mutation',
    fieldName: ['createOrder', 'cancelOrder'], // Or a pattern: /Order$/
    custom: ({ event }) => {
      // Only a custom reaches the caller or the raw event
      const { identity } = event
      if (!identity || !('groups' in identity)) return false

      return identity.groups?.includes('staff') ?? false
    },
  },
  handler: writeOrder,
})
```

| Filter | Type | Description |
| --- | --- | --- |
| `parentTypeName` | `FilterStringMatcher` | Matches the GraphQL type the field sits on, so `Query`, `Mutation`, `Subscription` or the parent type of a nested field resolver |
| `fieldName` | `FilterStringMatcher` | Matches the field being resolved |
| `custom` | `(input: AppSyncResolverFilterInput) => boolean \| Promise<boolean>` | Anything the other filters cannot express. Given `parentTypeName`, `fieldName` and the raw `event`. Can be async |

`FilterStringMatcher` is `string | RegExp | Array<string | RegExp>`. See
[filters](/docs/routing#filters) for how each form matches, including the `*` wildcard.

**`custom` sees the arguments before any schema has run**, so `event.arguments` there is
whatever the client sent. See [`custom`](/docs/routing#custom) for where it sits in the
filter order.

## Handler

Handlers take one argument and return the value of the field.

```ts
import type { AppSyncResolverRequest } from '@lambda-event-router/appsync'
import { logger } from '@lambda-event-router/base'

export async function getOrder(request: AppSyncResolverRequest<GetOrderArgs>): Promise<Order> {
  const { id } = request.arguments
  logger.info(`Resolving order ${id}`)

  return orders.byId(id)
}
```

### Request object

| Field | Type | Description |
| --- | --- | --- |
| `arguments` | `TArgs` | The field's arguments, validated when the route has an `argumentsSchema` |
| `identity` | `AppSyncIdentity` | Who the caller is. The shape follows the API's authorisation mode, and it is `undefined` under an API key |
| `source` | `Record<string, unknown> \| null` | The object the parent resolver returned, and `null` on a top level field |
| `info` | `{ selectionSetList, selectionSetGraphQL, parentTypeName, fieldName, variables }` | Which field is being resolved and which parts of it the client asked for |
| `headers` | `Record<string, string \| undefined>` | The headers the client sent to AppSync |
| `domainName` | `string \| null` | The custom domain the request arrived on, and `null` on the API's default one |
| `prev` | `{ result: Record<string, unknown> } \| null` | What the function before yours returned in a pipeline resolver |
| `stash` | `Record<string, unknown>` | State shared across the functions of a pipeline resolver |
| `event` | `AppSyncResolverEvent<TArgs>` | The untouched event from AWS |
| `context` | `Context` | The Lambda context |

`AppSyncResolverEvent`, `AppSyncIdentity` and `Context` all come from `aws-lambda` rather than from
this package.

**`identity` is a union of four shapes, one per authorisation mode.** Narrow it before reading a claim
off it: `'groups' in identity` picks out the Cognito user pool shape, and `'sub' in identity` covers
OpenID Connect as well.

**`arguments` has to be renamed when you destructure it.** It is a reserved word in strict mode, so
`const { arguments: args } = request` compiles and `const { arguments } = request` does not.

### Response type

Whatever you return becomes the value of the field. A route asks only for a `Promise<unknown>`, so the
return type is yours to name and there is no `AppSyncResolverResponse` to import.
[Responses](#responses) covers what AppSync does with it.

### Inferred handlers

Nothing to look up and nothing to keep in sync. `defineRoute` reads the schema and hands your handler
fully typed `arguments`, defaults and coercion included, so `quantity` below is a `number` without you
declaring that anywhere.

```ts
import { defineRoute } from '@lambda-event-router/appsync'
import { logger } from '@lambda-event-router/base'
import { z } from 'zod'

const CreateOrderSchema = z.object({
  input: z.object({ sku: z.string(), quantity: z.coerce.number().default(1) }),
})

export const createOrderRoute = defineRoute({
  filters: { parentTypeName: 'Mutation', fieldName: 'createOrder' },
  argumentsSchema: CreateOrderSchema,
}).handle(async ({ arguments: args }) => {
  const { sku, quantity } = args.input
  logger.info(`Creating ${quantity} of ${sku}`)

  return orders.create({ sku, quantity })
})

appSyncRouter.route(createOrderRoute)
```

**The builder is `defineRoute` here and named after its router on the other two.** The package holds
three routers, so [`AppSyncAuthorizerRouter`](/routers/AppSyncAuthorizerRouter) has
`defineAuthorizerRoute` and [`AppSyncEventsRouter`](/routers/AppSyncEventsRouter) has
`defineEventsRoute`.

Inference pays off most in a Lambda taking several event sources, since you never have to know any of
their request shapes. See [inferred handlers](/docs/handlers#inferred-handlers), where the same queue
is written both ways to compare.

### Annotated handlers

Annotating the request yourself splits route setup from business logic, using
[`AppSyncResolverRequest`](#generic-parameters) and your own types.

```ts
// handlers/orders.ts
import type { AppSyncResolverRequest } from '@lambda-event-router/appsync'
import { logger } from '@lambda-event-router/base'
import { z } from 'zod'

export const CreateOrderSchema = z.object({
  input: z.object({ sku: z.string(), quantity: z.coerce.number().default(1) }),
})
type CreateOrderArgs = z.infer<typeof CreateOrderSchema>

export async function createOrder(request: AppSyncResolverRequest<CreateOrderArgs>): Promise<Order> {
  const { sku, quantity } = request.arguments.input
  logger.info(`Creating ${quantity} of ${sku}`)

  return orders.create({ sku, quantity })
}
```

```ts
// appsync.ts
import { createAppSyncRouter } from '@lambda-event-router/appsync'

import { createOrder, CreateOrderSchema } from './handlers/orders.js'

const appSyncRouter = createAppSyncRouter()

appSyncRouter.mutation({
  fieldName: 'createOrder',
  argumentsSchema: CreateOrderSchema,
  handler: createOrder,
})
```

Derive the type from the schema with `z.infer` rather than hand-writing an interface that mirrors it.

All three registration forms take the type off the handler you pass them, so the same annotated
function goes through `route()`, one of the convenience methods and `defineRoute().handle()` equally.
[Annotated handlers](/docs/handlers#annotated-handlers) has the worked version.

## Schema validation

One key takes a schema and it is optional.

```ts
const CreateOrderSchema = z.object({
  input: z.object({
    sku: z.string(),
    quantity: z.coerce.number().int().positive().default(1),
  }),
})

appSyncRouter.route({
  filters: { parentTypeName: 'Mutation', fieldName: 'createOrder' },
  argumentsSchema: CreateOrderSchema,
  handler: createOrder,
})
```

| Key | Validates |
| --- | --- |
| `argumentsSchema` | The field's arguments |

Any [Standard Schema](https://standardschema.dev) library works. Validation runs after a route has
matched, so arguments failing their schema throw rather than falling through to the next route. See
[schema validation](/docs/routing#schema-validation) for what your handler receives after coercion.

GraphQL has already checked the arguments against the types in your API schema by this point, so what a
schema here adds is everything those types cannot say: a range, a format, a default or one field
depending on another.

## Responses

What a handler returns is what AppSync gets back, and it becomes the value of the field being resolved.
Nothing wraps it and nothing is added to it.

Nothing links that return type to the field's type in your API schema either, so the compiler will not
tell you when the two drift apart. AppSync will, at runtime, as an error on the field.

A throw lands the same way: the client gets `null` for the field and an entry in the response's
`errors` array, and the rest of the query still resolves. Where the field is non-null, the `null`
propagates up to the nearest parent that allows one.

## Middleware

Router and route middleware are both typed `AppSyncResolverMiddleware`, and the chain runs once per
invocation, which is once per field resolved.

```ts
import type { AppSyncResolverMiddleware } from '@lambda-event-router/appsync'
import { logger } from '@lambda-event-router/base'

export const withResolverContext: AppSyncResolverMiddleware = async (request, next) => {
  logger.appendKeys({ field: `${request.info.parentTypeName}.${request.info.fieldName}` })

  return next(request)
}
```

```ts
const appSyncRouter = createAppSyncRouter({ middleware: [withResolverContext] })

appSyncRouter.route({
  filters: { parentTypeName: 'Mutation', fieldName: 'createOrder' },
  middleware: [withOrderContext],
  handler: createOrder,
})
```

The arguments schema runs before either level, so a route whose arguments fail validation never reaches
its middleware. See [middleware](/docs/middleware) for the execution order and the three levels it
attaches at.

## Types

All exported from `@lambda-event-router/appsync`.

| Type | Description |
| --- | --- |
| `AppSyncResolverRequest<TArgs>` | The handler argument |
| `AppSyncResolverFilters` | The `filters` object |
| `AppSyncResolverFilterInput` | What `custom` receives |
| `AppSyncResolverFieldFilters` | The `filters` object on the convenience methods, which is `custom` on its own |
| `AppSyncResolverRouteDefinition<TArgs>` | A full route passed to `route()` |
| `AppSyncResolverFieldInput<TArgs>` | A route passed to one of the convenience methods |
| `AppSyncQueryInput<TArgs>`, `AppSyncMutationInput<TArgs>`, `AppSyncSubscriptionInput<TArgs>` | Aliases of `AppSyncResolverFieldInput<TArgs>`, one per method |
| `AppSyncResolverMiddleware<TArgs>` | Router and route middleware |
| `AppSyncRouterOptions` | Options for `createAppSyncRouter` |

The `AppSyncRouter` class and the `createAppSyncRouter` and `defineRoute` functions come from the same
place. Most of the type names carry `Resolver`, which is what keeps them apart from the other two
routers in the package, and the three aliases are named after their method instead.

There is no response type, since a handler's return type is yours to name.

### Generic parameters

Every type above that takes a parameter takes the same one.

| Parameter | Types | Default |
| --- | --- | --- |
| `TArgs` | `request.arguments` | `Record<string, unknown>` |

`AppSyncResolverRequest<CreateOrderArgs>` types the arguments and leaves the rest of the request alone.
You only need this for [annotated handlers](#annotated-handlers). Inference covers it.

## Nested field resolvers

A resolver on a field of one of your own types arrives with `parentTypeName` set to that type rather
than to `Query` or `Mutation`, which is why the convenience methods cannot register one.

```ts
appSyncRouter.route({
  filters: { parentTypeName: 'Order', fieldName: 'lines' },
  handler: getOrderLines,
})
```

`source` holds the object the parent resolver returned, so that is where the key you need comes from.
It is typed `Record<string, unknown> | null`, so check the field before you use it.

```ts
export async function getOrderLines({ source }: AppSyncResolverRequest): Promise<OrderLine[]> {
  const orderId = source?.id
  if (typeof orderId !== 'string') return []

  return lines.forOrder(orderId)
}
```

`info.selectionSetList` is the list of fields the client asked for on this one, which is worth reading
before a nested resolver goes and fetches all of them.

## Pipeline resolvers

A pipeline resolver runs several functions in order over one field, and two request fields carry state
between them. `prev.result` is what the function before yours returned, and `stash` is an object every
function in the pipeline shares.

```ts
export async function chargeOrder({ prev, stash }: AppSyncResolverRequest): Promise<Payment> {
  const order = prev?.result
  if (!order) throw new Error('chargeOrder runs after loadOrder and needs its result')

  stash.chargedAt = new Date().toISOString()

  return payments.charge(order)
}
```

**Nothing in `info` says which function of the pipeline is running.** Two of them resolving the same
field report the same `parentTypeName` and `fieldName`, so filters cannot tell them apart. Route on a
`custom` reading `stash`, or give the second function its own Lambda.

## Code example

An orders API with two queries, a mutation whose input is validated and a nested resolver for the lines
on an `Order`.

Open a file: [index.ts](#appsync-example:index.ts) | [AppSync router](#appsync-example:appsync.ts) | [handlers](#appsync-example:handlers/orders.ts) | [schemas](#appsync-example:schemas/order.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { appSyncRouter } from './appsync.js'

const lambdaRouter = new LambdaRouter({
  routers: [appSyncRouter],
})

export const handler: Handler = lambdaRouter.handler()`,
  },
  {
    path: 'appsync.ts',
    code: `import { createAppSyncRouter } from '@lambda-event-router/appsync'

import { createOrder, getOrder, getOrderLines, listOrders } from './handlers/orders.js'
import { CreateOrderSchema, GetOrderSchema } from './schemas/order.js'

export const appSyncRouter = createAppSyncRouter()

appSyncRouter
  .query({
    fieldName: 'getOrder',
    argumentsSchema: GetOrderSchema,
    handler: getOrder,
  })
  .query({
    fieldName: 'listOrders',
    handler: listOrders,
  })
  .mutation({
    fieldName: 'createOrder',
    argumentsSchema: CreateOrderSchema,
    handler: createOrder,
  })
  .route({
    filters: { parentTypeName: 'Order', fieldName: 'lines' },
    handler: getOrderLines,
  })`,
  },
  {
    path: 'handlers/orders.ts',
    code: `import type { AppSyncResolverRequest } from '@lambda-event-router/appsync'
import { logger } from '@lambda-event-router/base'

import type { CreateOrderArgs, GetOrderArgs } from '../schemas/order.js'

interface Order {
  id: string
  sku: string
  quantity: number
}

interface OrderLine {
  sku: string
  quantity: number
}

export async function getOrder({
  arguments: args,
}: AppSyncResolverRequest<GetOrderArgs>): Promise<Order> {
  logger.info(\`Resolving order \${args.id}\`)

  // e.g. read the order from DynamoDB
  return { id: args.id, sku: 'SKU-1', quantity: 2 }
}

export async function listOrders({ identity }: AppSyncResolverRequest): Promise<Order[]> {
  // The authorizer put the tenant on the caller's claims
  const tenantId = identity && 'claims' in identity ? identity.claims?.tenantId : undefined
  logger.info(\`Listing orders for tenant \${tenantId}\`)

  return [{ id: 'order-1', sku: 'SKU-1', quantity: 2 }]
}

export async function createOrder({
  arguments: args,
}: AppSyncResolverRequest<CreateOrderArgs>): Promise<Order> {
  const { sku, quantity } = args.input
  logger.info(\`Creating \${quantity} of \${sku}\`)

  return { id: 'order-2', sku, quantity }
}

// Resolves Order.lines, so the order itself arrives on source rather than in the arguments
export async function getOrderLines({ source }: AppSyncResolverRequest): Promise<OrderLine[]> {
  const orderId = source?.id
  if (typeof orderId !== 'string') return []

  logger.info(\`Resolving the lines of order \${orderId}\`)

  return [{ sku: 'SKU-1', quantity: 2 }]
}`,
  },
  {
    path: 'schemas/order.ts',
    code: `import { z } from 'zod'

export const GetOrderSchema = z.object({
  id: z.string(),
})

export const CreateOrderSchema = z.object({
  input: z.object({
    sku: z.string(),
    quantity: z.coerce.number().int().positive().default(1),
  }),
})

export type GetOrderArgs = z.infer<typeof GetOrderSchema>
export type CreateOrderArgs = z.infer<typeof CreateOrderSchema>`,
  },
]
</script>

<CodeFileViewer :files="files" id="appsync-example" default-file="appsync.ts" line-numbers collapse-toggle fixed-height />

Every route matches a different type and field pair, so no invocation can match two of them and the
order they are registered in makes no difference.

`Order.lines` goes through `route()` because the convenience methods only set the three top level type
names. `source` there is the order `getOrder` returned, and a client asking for `lines` on a list of
orders gets one invocation of `getOrderLines` per order in it.

`index.ts` hands the router to `LambdaRouter`, which is what AWS invokes and what every router in the
Lambda gets registered on. See [routers](/docs/routers) for how the two levels of matching fit
together.
