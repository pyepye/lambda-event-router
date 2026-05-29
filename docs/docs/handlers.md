# Handlers

A handler is the function that runs when an event matches a route. Your business logic lives here, and
the rest of the library is there to get events to it already parsed and typed.

Handlers are always async and take a single argument. What they return is set by the event source. You
can let `defineRoute` infer its types from the schemas on the route or name those types yourself, and
both are first-class.

## Requests

Each router hands your handler one object, typed as `<Source>Request`, and it arrives ready to use:

- JSON bodies and messages are parsed
- base64 payloads are decoded
- Message attributes come through as real values, so a number is a number and binary is a `Buffer`
- HTTP headers are lowercased
- Schema output is applied, so a `z.coerce.boolean().default(false)` reaches you as a `boolean`
- The raw `event` or `record` and the Lambda `context` are always there as a fallback

Record based routers call the handler once per record rather than once per batch, so a queue delivering
ten messages runs your handler ten times and you write code for a single message.

::: code-group

```ts [SQS]
// One record at a time, with the message body already parsed
async function processOrder({ body, messageAttributes, record, context }: SQSRequest<Order>) {
  logger.info('Processing order', {
    orderId: body.orderId, // parsed from the message JSON and typed by bodySchema
    dryRun: messageAttributes.dryRun, // a real value, not the raw AWS attribute wrapper
    attempt: record.attributes.ApproximateReceiveCount, // the raw record, for anything not lifted out
    requestId: context.awsRequestId, // the Lambda context
  })
}
```

```ts [API Gateway]
// Path and query params, headers and any authoriser claims, all on the one argument
async function updateOrder({
  path,
  query,
  body,
  headers,
  auth,
}: ApiRequest<PathParams, QueryParams, OrderUpdate>) {
  await orders.update(path.orderId, body, {
    notify: query.notify === 'true',
    idempotencyKey: headers['idempotency-key'], // headers are lowercased for you
    actor: auth?.claims?.sub, // undefined unless an authoriser ran
  })
  // ...
}
```

```ts [DynamoDB]
// Streams name the request after the event, so a modify carries both images
async function onOrderModified({ keys, newImage, oldImage }: DynamoDBModifyRequest<OrderKeys, Order, Order>) {
  if (newImage.status === oldImage.status) return

  await audit.record(keys.orderId, { from: oldImage.status, to: newImage.status })
}
```

:::

Field names are per router, and each [router page](/packages) documents its own.

## Responses

What you return is limited to what the event source can do with it, which is why this varies more
between routers than anything else. There are four shapes.

| Shape | Routers | What you write |
| --- | --- | --- |
| Nothing | Record based, so SQS, SNS, Kinesis and the rest | Do the work and return |
| A body the router wraps | HTTP | Return a value, or a status code and body |
| The event, changed | Cognito | Change the event and return it |
| A result the router reports | CodePipeline, S3 Batch | Return the outcome, or nothing |

::: code-group

```ts [SQS]
// SQSResponse is undefined, so there is nothing to hand back
async function adjustStock({ body }: SQSRequest<StockChange>): Promise<SQSResponse> {
  const remaining = await inventory.adjust(body.sku, body.delta)

  if (remaining <= body.reorderAt) {
    await purchasing.reorder(body.sku, body.reorderQuantity)
  }
}
```

```ts [API Gateway]
// Return a body and the router builds the response around it
async function getCustomerOrders({
  path,
  query,
}: ApiRequest<{ customerId: string }, { status?: string }>): Promise<HandlerResponse<OrderSummary[]>> {
  const customerOrders = await orders.forCustomer(path.customerId, query.status ?? 'OPEN')

  return customerOrders.map(({ orderId, total, placedAt }) => ({ orderId, total, placedAt }))
}
```

```ts [Cognito]
// Change the event and hand it back
async function preSignUp({ event, userAttributes }: PreSignUpRequest): Promise<PreSignUpTriggerEvent> {
  const domain = userAttributes.email?.split('@').at(1)
  if (!domain || !ALLOWED_DOMAINS.has(domain)) {
    throw new Error(`Sign up is not open to ${domain ?? 'addresses without a domain'}`)
  }

  event.response.autoConfirmUser = true
  event.response.autoVerifyEmail = true

  return event
}
```

```ts [CodePipeline]
// Return the outcome and the router calls PutJobSuccessResult for you
async function runMigrations({
  userParameters,
  inputArtifacts,
}: CodePipelineRequest<{ schema: string }>): Promise<CodePipelineResponse> {
  const [bundle] = inputArtifacts
  const applied = await migrate(userParameters.schema, bundle)

  return { outputVariables: { migrationsApplied: String(applied.length) } }
}
```

:::

### Throwing

Throwing from a handler fails the invocation, and what that costs depends on the source. Record based
routers report the failing record so it can be retried, and CodePipeline calls `PutJobFailureResult`
before rethrowing. Each router page covers its own behaviour and the options that change it.

The HTTP and authorizer routers go further and return a thrown response as the response, so
`APIGatewayRouter`, `ALBRouter`, `VPCLatticeRouter`, `WebSocketRouter`, `LambdaAuthorizerRouter` and
`AppSyncAuthorizerRouter`.

```ts
import { Conflict, NotFound } from '@lambda-event-router/apigateway'

export async function cancelOrderHandler({ path }: ApiRequest<{ orderId: string }>): Promise<OrderCancelled> {
  const order = await orders.get(path.orderId)
  if (!order) {
    throw NotFound({ error: `Order ${path.orderId} not found` })
  }
  if (order.status === 'SHIPPED') {
    throw Conflict({ error: 'Shipped orders cannot be cancelled' })
  }

  await orders.update(order.orderId, { status: 'CANCELLED' })
  await refunds.start(order)
  await notifications.send(order.customerEmail, 'order-cancelled')

  return { orderId: order.orderId, status: 'CANCELLED' }
}
```

A throw carries the same weight from any depth, so business logic several calls below the handler can
end the request without each function in between passing a failure back up.

The authorizer routers work the same way with `Allow` and `Deny`.

**Anything else thrown from an HTTP handler becomes a 500 with the error message as the response
body.** Keep internal detail out of the messages your handlers can throw, because an error naming a
connection string or an internal hostname puts it on the wire.

```ts
// A plain Error is not a response, so the router logs it and answers with a 500
export async function getOrderHandler({ path }: ApiRequest<{ orderId: string }>) {
  const order = await orders.get(path.orderId) // Throws Error('connect ETIMEDOUT 10.0.1.5:8000')

  return { orderId: order.orderId, status: order.status } // Does not get reached
}

// The caller gets { "statusCode": 500, "body": { "error": "connect ETIMEDOUT 10.0.1.5:8000" }}
```

### HTTP responses

A bare value becomes a 200 and the body is serialised for you, so these three are the same response:

```ts
import { Ok } from '@lambda-event-router/apigateway'

return { orderId: order.orderId }
return Ok({ orderId: order.orderId })
return { statusCode: 200, body: { orderId: order.orderId } }
```

For any other code, use a helper or set it yourself, so `Created(order)` and
`{ statusCode: 201, body: order }` both give a 201. `Ok`, `Created`, `NoContent`, `NotFound`,
`BadRequest`, `Conflict` and the rest are all exported from the router's package.

Empty returns become a 204 rather than a 200 with nothing in it.

| You return | You get |
| --- | --- |
| An object or an array | 200, with a JSON content type |
| A string, a number or another primitive | 200 |
| `undefined`, `null`, `''`, `true` or `{}` | 204 |

## Schema validation

Schemas are attached to the route rather than to the handler, and the validated output is what your
handler receives, so defaults and coercion are applied before your code runs. See
[routing](/docs/routing#schema-validation) for where the schemas go and what a failure does.

```ts
const BlogEventSchema = z.object({
  blogId: z.string(),
  publishedAt: z.coerce.date(),
  draft: z.coerce.boolean().default(false),
})

kinesisRouter.route({
  filters: { eventSourceArn: BLOG_STREAM_ARN },
  dataSchema: BlogEventSchema,
  handler: async ({ data }) => {
    // publishedAt is a Date and draft is a boolean, whatever the record held
    if (data.draft) return

    await search.index(data.blogId, { publishedAt: data.publishedAt })
  },
})
```

## Inferred handlers

This section and the next process the same order queue, once each way, so you can compare them.

`defineRoute` reads the schemas on the route and hands your handler a typed request, so you never need
to know the shape of any router's request object. No types to declare and nothing to keep in sync as
the schemas change.

Open a file: [routes/processOrder.ts](#inferred-handlers:routes/processOrder.ts) |
[schemas/order.ts](#inferred-handlers:schemas/order.ts) | [sqs.ts](#inferred-handlers:sqs.ts) |
[index.ts](#inferred-handlers:index.ts)

<script setup>
const ENTRY_POINT = `import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { sqsRouter } from './sqs.js'

const lambdaRouter = new LambdaRouter({
  routers: [sqsRouter],
})

export const handler: Handler = lambdaRouter.handler()`

// Identical in both examples
const ORDER_SCHEMAS = `import { z } from 'zod'

export const OrderSchema = z.object({
  orderId: z.string(),
  customerEmail: z.string(),
  items: z.array(z.object({ sku: z.string(), price: z.number(), quantity: z.number() })),
})

export const OrderAttributesSchema = z.object({ dryRun: z.coerce.boolean().default(false) })`

const HANDLER_BODY = `  const total = body.items.reduce((sum, { price, quantity }) => sum + price * quantity, 0)

  if (messageAttributes.dryRun) {
    logger.info('Dry run, order not saved', { orderId: body.orderId, total })
    return
  }

  await orders.save({ ...body, total, status: 'CONFIRMED' })
  await notifications.send(body.customerEmail, 'order-confirmed', { total })`

const inferredFiles = [
  {
    path: 'routes/processOrder.ts',
    code: `import { defineRoute } from '@lambda-event-router/sqs'

import { OrderAttributesSchema, OrderSchema } from '../schemas/order.js'
import { notifications, orders } from '../services/orders.js'

const ORDER_QUEUE_ARN = 'arn:aws:sqs:eu-west-2:123456789012:orders'

export const processOrderRoute = defineRoute({
  filters: { eventSourceArn: ORDER_QUEUE_ARN },
  bodySchema: OrderSchema,
  messageAttributesSchema: OrderAttributesSchema,
}).handle(async ({ body, messageAttributes }) => {
  // No types named anywhere. defineRoute infers the request from the two schemas
${HANDLER_BODY}
})`,
  },
  { path: 'schemas/order.ts', code: ORDER_SCHEMAS },
  {
    path: 'sqs.ts',
    code: `import { createSQSRouter } from '@lambda-event-router/sqs'

import { processOrderRoute } from './routes/processOrder.js'

export const sqsRouter = createSQSRouter()

// The route arrives complete, filters and schemas included
sqsRouter.route(processOrderRoute)`,
  },
  { path: 'index.ts', code: ENTRY_POINT },
]

const annotatedFiles = [
  {
    path: 'handlers/processOrder.ts',
    code: `import type { SQSMessageAttributes, SQSRequest, SQSResponse } from '@lambda-event-router/sqs'
import type { z } from 'zod'

import { OrderAttributesSchema, OrderSchema } from '../schemas/order.js'
import { notifications, orders } from '../services/orders.js'

// The types defineRoute would have inferred, named here instead
type Order = z.infer<typeof OrderSchema>
type OrderAttributes = z.infer<typeof OrderAttributesSchema> & SQSMessageAttributes

export async function processOrder(request: SQSRequest<Order, OrderAttributes>): Promise<SQSResponse> {
  const { body, messageAttributes } = request
${HANDLER_BODY}
}`,
  },
  { path: 'schemas/order.ts', code: ORDER_SCHEMAS },
  {
    path: 'sqs.ts',
    code: `import { createSQSRouter } from '@lambda-event-router/sqs'

import { processOrder } from './handlers/processOrder.js'
import { OrderAttributesSchema, OrderSchema } from './schemas/order.js'

const ORDER_QUEUE_ARN = 'arn:aws:sqs:eu-west-2:123456789012:orders'

export const sqsRouter = createSQSRouter()

// Filters, schemas and handler are brought together here instead
sqsRouter.route({
  filters: { eventSourceArn: ORDER_QUEUE_ARN },
  bodySchema: OrderSchema,
  messageAttributesSchema: OrderAttributesSchema,
  handler: processOrder,
})`,
  },
  { path: 'index.ts', code: ENTRY_POINT },
]
</script>

<CodeFileViewer :files="inferredFiles" id="inferred-handlers" default-file="routes/processOrder.ts" line-numbers collapse-toggle fixed-height />

This pays off in a Lambda taking several event sources. SQS, API Gateway and DynamoDB Streams hand
their handlers completely different objects, and inference gets all three typed without you looking
any of them up.

`defineRoute` is named `define<Router>Route` in packages holding more than one router, and
`defineEventRoute` in `base`.

## Annotated handlers

The same queue again, with the handler's types named rather than inferred. That puts an explicit type
at the boundary and leaves the handler a plain function, at the cost of writing those types yourself.

Open a file: [handlers/processOrder.ts](#annotated-handlers:handlers/processOrder.ts) |
[schemas/order.ts](#annotated-handlers:schemas/order.ts) | [sqs.ts](#annotated-handlers:sqs.ts) |
[index.ts](#annotated-handlers:index.ts)

<CodeFileViewer :files="annotatedFiles" id="annotated-handlers" default-file="handlers/processOrder.ts" line-numbers collapse-toggle fixed-height />

Same four files, same schemas, same handler body. Both differ in one thing only, which is that
`SQSRequest<Order, OrderAttributes>` names what `defineRoute` worked out for itself.

Derive those types from the schema with `z.infer` rather than writing an interface that mirrors it, so
the two cannot drift.

**A message attribute type is only accepted if every value is a `string`, a `number` or a `Buffer`.**
`z.infer` on `OrderAttributesSchema` gives `{ dryRun: boolean }`, which `SQSRequest` rejects on its
own. Intersecting it with `SQSMessageAttributes` satisfies the constraint and leaves `dryRun` as a
`boolean`. Inferred handlers never meet this, because `defineRoute` applies the intersection for you.

Most routers take the payload first and its attributes second, the way
`SQSRequest<TBody, TMessageAttributes>` does, and later parameters have defaults so passing only the
first leaves the rest alone. Each router page lists its own parameters in order.
