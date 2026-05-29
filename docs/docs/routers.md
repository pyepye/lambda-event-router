# Routers

A router handles one AWS event source. It recognises the events that source sends and calls the handler
you registered for them, giving it a typed object rather than a raw AWS envelope.

You create a router for each event source your Lambda receives, register routes on it, then hand it to
`LambdaRouter`.

Matching happens at two levels. `LambdaRouter` works out which router should handle the event, then
that router works out which of its routes should handle it. Everything else here assumes that split.

```ts
// index.ts
import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { snsRouter } from './sns.js'
import { sqsRouter } from './sqs.js'

// Level one: LambdaRouter picks which router handles the event
const lambdaRouter = new LambdaRouter({ routers: [sqsRouter, snsRouter] })

export const handler: Handler = lambdaRouter.handler()
```

```ts
// sqs.ts
import { createSQSRouter } from '@lambda-event-router/sqs'

import { processOrder } from './handlers/processOrder.js'

export const sqsRouter = createSQSRouter()

// Level two: the router picks which route handles the record
sqsRouter.route({
  filters: { eventSourceArn: ORDER_QUEUE_ARN },
  handler: processOrder,
})
```

See [quick start](/docs/quick-start) to build that up step by step.

## Same shape everywhere

Learn one router and the rest read in a similar way, so a Lambda handling four event sources does not
mean four different mental models.

### Exports

Every package exports the same three things, with `<Source>` standing in for the service.

| Name | What it is |
| --- | --- |
| `create<Source>Router(options)` | Factory function, what you normally reach for |
| `<Source>Router` | The class behind it, if you would rather use `new` |
| `defineRoute` | Builds a route with the types inferred from your schemas |

So Kinesis gives you `createKinesisRouter` and Firehose gives you `createFirehoseRouter`, without you
having to look either up.

### Types

These are the types you will actually import. Everything else is inferred, so you pass object literals
rather than naming their types.

| Type | When you need it |
| --- | --- |
| `<Source>Request` | [Annotating a handler](/docs/handlers#annotated-handlers) rather than inferring it |
| `<Source>Response` | Typing what that handler returns |
| `<Source>Middleware` | Writing [middleware](/docs/middleware) in its own file |
| `<Source>FilterInput` | Writing a [`custom`](/docs/routing#custom) as a named function |

Each router page lists its full set, including the options and route definition types, for the times
you want them.

### Routes

`route({ filters, handler })` works on every router, and every options object takes `middleware`. Only
the service specific filter keys change.

```ts
// SNS, filtering on the topic and a message attribute
snsRouter.route({
  filters: {
    topicArn: ORDER_TOPIC_ARN,
    messageAttributes: { type: 'OrderPlaced' },
  },
  handler: onOrderPlaced,
})

// DynamoDB Streams. Same call, and the keys come from the stream
dynamoRouter.route({
  filters: {
    eventName: 'INSERT',
    eventSourceArn: ORDER_TABLE_STREAM_ARN,
  },
  handler: onOrderInserted,
})
```

[Routing](/docs/routing) covers all of this in full: the filter keys, `custom`, match order and
where the schemas go. A few routers also add shorthand methods, so `dynamoRouter.insert()` is the
route above with its `eventName` already filled in.

### Naming variations

A few names vary, and they are worth knowing before you go looking for them:

- `base` exports `defineEventRoute`, not `defineRoute`
- Packages holding more than one router may name it `define<Router>Route`
- Routers with per event variants name their requests after the event, so DynamoDB gives you
  `DynamoDBInsertRequest` and `DynamoDBRemoveRequest` rather than one `DynamoDBRequest`
- Some types come from `aws-lambda` rather than the package, usually the record type and `Context`

## Choosing a router

Every Lambda has a `LambdaRouter`, and it takes as many event routers as you need. What you choose is
which of those to register on it.

Most services have a single router, so SQS gives you `SQSRouter` and nothing else to weigh up. A few
send more than one kind of event and have a router for each, so API Gateway has `APIGatewayRouter`,
`WebSocketRouter` and `LambdaAuthorizerRouter`. Choose per event source rather than per service.

| Your event source | What to use |
| --- | --- |
| Triggers Lambda natively | The router for that service. See [packages](/packages) for the full list |
| Has no Lambda trigger | Send CloudTrail to EventBridge, then `EventBridgeRouter` |
| Has a custom envelope | `EventRouter`. Covers EventBridge Scheduler and your own invoke payloads |

## Requests and responses

Both sides of a handler vary by event source: what it is given, and what it is allowed to send back.
[Handlers](/docs/handlers) covers the two together, and each router page documents its own fields.

**Read what a router's options do rather than going by the name.** Options follow what each service
supports, so the same name can mean different things in two packages. `batchItemFailures` on SQS
reports individual record failures so only those get redelivered, while SNS has no mechanism for that
and swallows the error instead.

## Unique routers

Three routers are worth knowing about whatever your event source is. The rest are tied to one service
and live on [packages](/packages).

### LambdaRouter

The Lambda entry point. `lambdaRouter.handler()` is what you export, and every router gets registered
on it.

It picks a router per event using each router's `canHandleEvent`, first match wins, and throws if
nothing matches. A router that claims an event and has no route for it hands back rather than failing,
so the next one gets a turn.

Middleware passed to `LambdaRouter` runs for every event, so tracing and logging belong here rather
than being repeated on each router. It runs on the raw event and has a different signature to router
and route middleware, since no router has been picked yet. See [middleware](/docs/middleware).

::: info
`EventRouter` is sorted to the end of the list whatever order you register in, because its check is a
catch-all. This means it can never take an event a dedicated router would have handled.
:::

More on [LambdaRouter](/routers/LambdaRouter).

### EventRouter

For events with a totally custom envelope. It lives in the base package, so there is nothing extra to
install.

It refuses any event it recognises as a known AWS source, so adding an `EventRouter` cannot quietly
break routing for the rest of your Lambda.

`custom` is its only filter, and `eventSchema` gives you validation and typing. Routes are built
with `defineEventRoute`.

More on [EventRouter](/routers/EventRouter).

### EventBridgeRouter

Covers EventBridge buses, pipes and rules, and reaches services that cannot trigger Lambda at all by
way of CloudTrail.

Both arrive as the same EventBridge envelope, so a CloudTrail event routes and types exactly like one
you published yourself.

EventBridge Scheduler is the exception, as it delivers whatever payload you configured rather than an
EventBridge envelope. Use `EventRouter` for those.

More on [EventBridgeRouter](/routers/EventBridgeRouter).
