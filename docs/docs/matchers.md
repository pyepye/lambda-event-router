# Matchers

A matcher handles one AWS event source. It recognises the events that source sends and calls the handler
you registered for them, giving it a typed object rather than a raw AWS envelope.

You create a matcher for each event source your Lambda receives, register routes on it, then hand it to
`Latcher`.

Matching happens at two levels. `Latcher` works out which matcher should handle the event, then
that matcher works out which of its routes should handle it. Everything else here assumes that split.

```ts
// index.ts
import type { Handler } from 'aws-lambda'
import { Latcher } from '@latcher/base'

import { snsMatcher } from './sns.js'
import { sqsMatcher } from './sqs.js'

// Level one: Latcher picks which matcher handles the event
const latcher = new Latcher({ matchers: [sqsMatcher, snsMatcher] })

export const handler: Handler = latcher.handler()
```

```ts
// sqs.ts
import { createSQSMatcher } from '@latcher/sqs'

import { processOrder } from './handlers/processOrder.js'

export const sqsMatcher = createSQSMatcher()

// Level two: the matcher picks which route handles the record
sqsMatcher.route({
  filters: { eventSourceArn: ORDER_QUEUE_ARN },
  handler: processOrder,
})
```

See [quick start](/docs/quick-start) to build that up step by step.

## Same shape everywhere

Learn one matcher and the rest read in a similar way, so a Lambda handling four event sources does not
mean four different mental models.

### Exports

Every package exports the same three things, with `<Source>` standing in for the service.

| Name | What it is |
| --- | --- |
| `create<Source>Matcher(options)` | Factory function, what you normally reach for |
| `<Source>Matcher` | The class behind it, if you would rather use `new` |
| `defineRoute` | Builds a route with the types inferred from your schemas |

So Kinesis gives you `createKinesisMatcher` and Firehose gives you `createFirehoseMatcher`, without you
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

Each matcher page lists its full set, including the options and route definition types, for the times
you want them.

### Routes

`route({ filters, handler })` works on every matcher, and every options object takes `middleware`. Only
the service specific filter keys change.

```ts
// SNS, filtering on the topic and a message attribute
snsMatcher.route({
  filters: {
    topicArn: ORDER_TOPIC_ARN,
    messageAttributes: { type: 'OrderPlaced' },
  },
  handler: onOrderPlaced,
})

// DynamoDB Streams. Same call, and the keys come from the stream
dynamoMatcher.route({
  filters: {
    eventName: 'INSERT',
    eventSourceArn: ORDER_TABLE_STREAM_ARN,
  },
  handler: onOrderInserted,
})
```

[Routing](/docs/routing) covers all of this in full: the filter keys, `custom`, match order and
where the schemas go. A few matchers also add shorthand methods, so `dynamoMatcher.insert()` is the
route above with its `eventName` already filled in.

### Naming variations

A few names vary, and they are worth knowing before you go looking for them:

- `base` exports `defineEventRoute`, not `defineRoute`
- Packages holding more than one matcher may name it `define<Matcher>Route`
- Matchers with per event variants name their requests after the event, so DynamoDB gives you
  `DynamoDBInsertRequest` and `DynamoDBRemoveRequest` rather than one `DynamoDBRequest`
- Some types come from `aws-lambda` rather than the package, usually the record type and `Context`

## Choosing a matcher

Every Lambda has a `Latcher`, and it takes as many event matchers as you need. What you choose is
which of those to register on it.

Most services have a single matcher, so SQS gives you `SQSMatcher` and nothing else to weigh up. A few
send more than one kind of event and have a matcher for each, so API Gateway has `APIGatewayMatcher`,
`WebSocketMatcher` and `LambdaAuthorizerMatcher`. Choose per event source rather than per service.

| Your event source | What to use |
| --- | --- |
| Triggers Lambda natively | The matcher for that service. See [packages](/packages) for the full list |
| Has no Lambda trigger | Send CloudTrail to EventBridge, then `EventBridgeMatcher` |
| Has a custom envelope | `EventMatcher`. Covers EventBridge Scheduler and your own invoke payloads |

## Requests and responses

Both sides of a handler vary by event source: what it is given, and what it is allowed to send back.
[Handlers](/docs/handlers) covers the two together, and each matcher page documents its own fields.

**Read what a matcher's options do rather than going by the name.** Options follow what each service
supports, so the same name can mean different things in two packages. `batchItemFailures` on SQS
reports individual record failures so only those get redelivered, while SNS has no mechanism for that
and swallows the error instead.

## Unique matchers

Three matchers are worth knowing about whatever your event source is. The rest are tied to one service
and live on [packages](/packages).

### Latcher

The Lambda entry point. `latcher.handler()` is what you export, and every matcher gets registered
on it.

It picks a matcher per event using each matcher's `canHandleEvent`, first match wins, and throws if
nothing matches. A matcher that claims an event and has no route for it hands back rather than failing,
so the next one gets a turn.

Middleware passed to `Latcher` runs for every event, so tracing and logging belong here rather
than being repeated on each matcher. It runs on the raw event and has a different signature to matcher
and route middleware, since no matcher has been picked yet. See [middleware](/docs/middleware).

::: info
`EventMatcher` is sorted to the end of the list whatever order you register in, because its check is a
catch-all. This means it can never take an event a dedicated matcher would have handled.
:::

More on [Latcher](/matchers/Latcher).

### EventMatcher

For events with a totally custom envelope. It lives in the base package, so there is nothing extra to
install.

It refuses any event it recognises as a known AWS source, so adding an `EventMatcher` cannot quietly
break routing for the rest of your Lambda.

`custom` is its only filter, and `eventSchema` gives you validation and typing. Routes are built
with `defineEventRoute`.

More on [EventMatcher](/matchers/EventMatcher).

### EventBridgeMatcher

Covers EventBridge buses, pipes and rules, and reaches services that cannot trigger Lambda at all by
way of CloudTrail.

Both arrive as the same EventBridge envelope, so a CloudTrail event routes and types exactly like one
you published yourself.

EventBridge Scheduler is the exception, as it delivers whatever payload you configured rather than an
EventBridge envelope. Use `EventMatcher` for those.

More on [EventBridgeMatcher](/matchers/EventBridgeMatcher).
