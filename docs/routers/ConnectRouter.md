# ConnectRouter

`ConnectRouter` routes Amazon Connect contact flow events to handlers, one contact per invocation.

Connect calls your Lambda from an Invoke AWS Lambda function block in a contact flow. Each call carries
one contact, with the channel it came in on and the method that started it. The router matches on those
and hands your handler the contact to act on and a map of values to return to the flow.

## Install

```bash
npm install @lambda-event-router/connect
```

`@lambda-event-router/base` comes along as a dependency, so you do not need to install it yourself.

## Create the router

```ts
import { createConnectRouter } from '@lambda-event-router/connect'
import { logInvocation } from './middleware/logInvocation'

const connectRouter = createConnectRouter({
  middleware: [logInvocation],  // Optional
})
```

`createConnectRouter()` on its own gives you a router with no shared middleware.

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `middleware` | `ConnectMiddleware[]` | No | `[]` | Runs for every contact this router handles, before any route middleware. See [Middleware](#middleware) |

## Register routes

```ts
connectRouter.route({
  filters: {
    channel: 'VOICE',
    initiationMethod: 'INBOUND',
  },
  middleware: [withContactContext],  // Optional
  handler: greetInboundCaller,
})
```

`filters` and `handler` are the only required keys, and `filters` can be an empty object to match every
contact.

`route()` returns the router, so you can chain registrations.

```ts
connectRouter.route(inboundVoiceRoute).route(chatRoute)
```

Routes match in registration order and the first match wins, so give each route filters no other route
can match. See [match order](/docs/routing#match-order) for what goes wrong when they overlap.

**A contact that matches no route throws** `No route matched for Amazon Connect event (channel: ...,
initiationMethod: ...)`. Connect expects a response, so an unmatched contact fails the invocation and
the flow takes the Error branch of the block rather than falling through. Register a filter-less
catch-all last if you would rather handle everything else in one place, and see [nothing
matched](/docs/routing#nothing-matched) for what the other routers do instead.

A contact carries metadata about a call or chat rather than a payload you control, so there is nothing
to validate and no schema validation section on this page.

### Convenience methods

Each convenience method presets one filter key, so you register with the rest of the filters and the
method fills in the channel or the initiation method.

```ts
connectRouter.voice({
  filters: { initiationMethod: 'INBOUND' },
  handler: greetInboundCaller,
})

// The same route through route()
connectRouter.route({
  filters: { channel: 'VOICE', initiationMethod: 'INBOUND' },
  handler: greetInboundCaller,
})
```

| Method | Presets |
| --- | --- |
| `voice` | `channel: 'VOICE'` |
| `chat` | `channel: 'CHAT'` |
| `email` | `channel: 'EMAIL'` |
| `inbound` | `initiationMethod: 'INBOUND'` |
| `outbound` | `initiationMethod: 'OUTBOUND'` |
| `transfer` | `initiationMethod: 'TRANSFER'` |
| `callback` | `initiationMethod: 'CALLBACK'` |
| `api` | `initiationMethod: 'API'` |

A channel method still takes an `initiationMethod` filter and the reverse, so
`voice({ filters: { initiationMethod: 'INBOUND' } })` matches inbound voice contacts. A channel
method's filters omit `channel` and an initiation-method method's omit `initiationMethod`, so the key
the method presets is set through the method and passing it in `filters` is a type error. See
[convenience methods](/docs/routing#convenience-methods) for how the other routers use them.

## Filters

Every filter key on one route, showing each form a value can take. All of them are optional, so set the
ones that pick out the contacts you want and leave the rest off.

```ts
connectRouter.route({
  filters: {
    channel: ['VOICE', 'CHAT', 'EMAIL'],
    initiationMethod: ['INBOUND', 'OUTBOUND', 'TRANSFER', 'CALLBACK', 'API'],
    instanceArn: CONNECT_INSTANCE_ARN, // Or a pattern: /:instance\//
    custom: ({ event }) => event.Details.ContactData.Queue?.Name === 'support',
  },
  handler: routeContact,
})
```

| Filter | Type | Description |
| --- | --- | --- |
| `channel` | `ConnectChannel \| ConnectChannel[]` | Exact match against the contact's channel, one of `VOICE`, `CHAT` or `EMAIL`. Not a pattern, so list every channel you want |
| `initiationMethod` | `ConnectInitiationMethod \| ConnectInitiationMethod[]` | Exact match against how the contact started: `INBOUND`, `OUTBOUND`, `TRANSFER`, `CALLBACK` or `API` |
| `instanceArn` | `FilterStringMatcher` | Matches the ARN of the Connect instance the contact belongs to |
| `custom` | `(input: ConnectFilterInput) => boolean \| Promise<boolean>` | Given the channel, the initiation method and the raw event. Anything the other filters cannot express. Can be async |

`channel` and `initiationMethod` are exact-match unions, not patterns, so a value has to be one of the
ones listed. Only `instanceArn` is a `FilterStringMatcher`, which is `string | RegExp | Array<string |
RegExp>`. See [filters](/docs/routing#filters) for how each form matches, including the `*` wildcard.

**`custom` is the only filter that reaches the whole event.** Its `event` is the typed
`ConnectContactFlowEvent`, so use it to match on the queue, customer endpoint or a contact attribute
that no built-in key covers. See [`custom`](/docs/routing#custom) for where it sits in the
filter order.

## Handler

Handlers take one argument and return a map of values for the flow.

```ts
import { logger } from '@lambda-event-router/base'
import type { ConnectRequest, ConnectResponse } from '@lambda-event-router/connect'

export async function greetInboundCaller({ contactData }: ConnectRequest): Promise<ConnectResponse> {
  logger.info(`Inbound voice contact ${contactData.ContactId} from ${contactData.CustomerEndpoint?.Address}`)
  return { greeting: 'Welcome back' }
}
```

### Request object

| Field | Type | Description |
| --- | --- | --- |
| `contactData` | `ConnectContactFlowEvent['Details']['ContactData']` | The contact: its channel, initiation method, queue, customer endpoint, saved attributes and the rest |
| `parameters` | `Record<string, string>` | The key/value parameters set on the Invoke AWS Lambda function block for this call |
| `event` | `ConnectContactFlowEvent` | The untouched event from AWS |
| `context` | `Context` | The Lambda context |

`ConnectContactFlowEvent` and `Context` come from `aws-lambda`, not this package. `contactData` and
`parameters` are the `Details.ContactData` and `Details.Parameters` off that event.

### Response type

`ConnectResponse` is `ConnectContactFlowResult`, a flat map of string values. See
[Responses](#responses) for what Connect does with it and the shape it has to be in.

### Inferred handlers

`defineRoute` types the handler from the router, so you get `contactData`, `parameters`, `event` and
`context` without naming `ConnectRequest` anywhere.

```ts
import { logger } from '@lambda-event-router/base'
import { defineRoute } from '@lambda-event-router/connect'

export const greetInboundCaller = defineRoute({
  filters: { channel: 'VOICE', initiationMethod: 'INBOUND' },
}).handle(async ({ contactData }) => {
  logger.info(`Inbound voice contact ${contactData.ContactId}`)
  return { greeting: 'Welcome back' }
})

connectRouter.route(greetInboundCaller)
```

Not having to name the request shape pays off most in a Lambda taking several event sources, since
every router hands its handler something different. See [inferred
handlers](/docs/handlers#inferred-handlers), where the same source is written both ways to compare.

### Annotated handlers

Annotating the request yourself splits route setup from business logic, using
[`ConnectRequest`](#types) as the argument type.

```ts
// handlers/greetInboundCaller.ts
import { logger } from '@lambda-event-router/base'
import type { ConnectRequest, ConnectResponse } from '@lambda-event-router/connect'

export async function greetInboundCaller({ contactData }: ConnectRequest): Promise<ConnectResponse> {
  logger.info(`Inbound voice contact ${contactData.ContactId}`)
  return { greeting: 'Welcome back' }
}
```

```ts
// connect.ts
import { createConnectRouter } from '@lambda-event-router/connect'
import { greetInboundCaller } from './handlers/greetInboundCaller'

const connectRouter = createConnectRouter()

connectRouter.voice({
  filters: { initiationMethod: 'INBOUND' },
  handler: greetInboundCaller,
})
```

`ConnectRequest` is the whole request type. There is no schema and no generic parameter, so nothing to
derive with `z.infer` and nothing to keep in sync. A handler typed `ConnectRequest` fits every
registration form, `route()` and each convenience method, since they all take the same handler
signature. See [annotated handlers](/docs/handlers#annotated-handlers) for the worked version.

## Responses

Your handler returns a flat object of string key/value pairs and the router hands it straight back to
Connect, so `ConnectResponse` is `ConnectContactFlowResult`, `Record<string, string | null>`. The
return shape is Connect's contract rather than the router's.

```ts
return {
  customerBalance: '1000',
  greeting: 'Welcome back',
}
```

Connect exposes each pair to the flow. Reference a value directly as `$.External.<key>`, for example
`$.External.greeting`, or store it with a Set contact attributes block to keep it for later blocks.

Keep the object flat and every value a string when the block validates the response as a `STRING_MAP`,
which is the shape `ConnectContactFlowResult` describes. Nested objects and arrays only reach the flow
when the block is set to JSON validation instead. The returned data has to be under 32 KB.

**Throwing from a handler, timing out or returning something Connect cannot read sends the contact down
the Error branch of the block.** An unmatched contact throws, so it lands there too.

## Middleware

Router and route middleware are both typed `ConnectMiddleware`, and the chain runs once per contact.

```ts
import { logger } from '@lambda-event-router/base'
import type { ConnectMiddleware } from '@lambda-event-router/connect'

export const logInvocation: ConnectMiddleware = async (request, next) => {
  logger.info(`Handling ${request.contactData.Channel} contact ${request.contactData.ContactId}`)
  return next(request)
}
```

```ts
const connectRouter = createConnectRouter({ middleware: [logInvocation] })

connectRouter.route({
  filters: { channel: 'VOICE' },
  middleware: [withContactContext],
  handler: routeContact,
})
```

Router middleware runs before route middleware. See [middleware](/docs/middleware) for the execution
order and the three levels it attaches at.

## Types

All exported from `@lambda-event-router/connect`.

| Type | Description |
| --- | --- |
| `ConnectRequest` | The handler argument |
| `ConnectResponse` | Handler return type, `ConnectContactFlowResult` |
| `ConnectHandler` | The handler function, `(request: ConnectRequest) => Promise<ConnectResponse>` |
| `ConnectFilters` | The `filters` object |
| `ConnectFilterInput` | What `custom` receives |
| `ConnectChannel` | `'VOICE' \| 'CHAT' \| 'EMAIL'` |
| `ConnectInitiationMethod` | `'INBOUND' \| 'OUTBOUND' \| 'TRANSFER' \| 'CALLBACK' \| 'API'` |
| `ConnectMiddleware` | Router and route middleware |
| `ConnectRouteDefinition` | A full route passed to `route()` |
| `ConnectChannelRouteDefinition` | A route passed to a channel method |
| `ConnectInitiationMethodRouteDefinition` | A route passed to an initiation-method method |
| `ConnectChannelFilters` | The `filters` for a channel method |
| `ConnectInitiationMethodFilters` | The `filters` for an initiation-method method |
| `ConnectRouterOptions` | Options for `createConnectRouter` |

The `ConnectRouter` class and the `createConnectRouter` and `defineRoute` functions come from the same
place.

No Connect type takes a generic parameter. The request and response shapes are fixed by the event, so
there is no `### Generic parameters` table that a reader arriving from another router might expect.

## Code example

One Lambda fronting a contact centre: greeting inbound voice callers, answering chats and emails, and a
catch-all for everything else.

Open a file: [index.ts](#connect-example:index.ts) | [Connect router](#connect-example:connect.ts) | [handlers](#connect-example:handlers/contacts.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { connectRouter } from './connect.js'

const lambdaRouter = new LambdaRouter({
  routers: [connectRouter],
})

export const handler: Handler = lambdaRouter.handler()`,
  },
  {
    path: 'connect.ts',
    code: `import { createConnectRouter } from '@lambda-event-router/connect'

import { defaultContact, greetInboundCaller, handleChat, handleEmail } from './handlers/contacts.js'

export const connectRouter = createConnectRouter()

connectRouter
  .voice({
    filters: { initiationMethod: 'INBOUND' },
    handler: greetInboundCaller,
  })
  .chat({ filters: {}, handler: handleChat })
  .email({ filters: {}, handler: handleEmail })
  .route({ filters: {}, handler: defaultContact })`,
  },
  {
    path: 'handlers/contacts.ts',
    code: `import { logger } from '@lambda-event-router/base'
import type { ConnectRequest, ConnectResponse } from '@lambda-event-router/connect'

export async function greetInboundCaller({ contactData }: ConnectRequest): Promise<ConnectResponse> {
  logger.info(\`Inbound voice contact \${contactData.ContactId} from \${contactData.CustomerEndpoint?.Address}\`)
  return { greeting: 'Welcome back', queue: 'sales' }
}

export async function handleChat({ contactData }: ConnectRequest): Promise<ConnectResponse> {
  logger.info(\`Chat contact \${contactData.ContactId}\`)
  return { greeting: 'How can we help?' }
}

export async function handleEmail({ contactData }: ConnectRequest): Promise<ConnectResponse> {
  logger.info(\`Email contact \${contactData.ContactId}\`)
  return { acknowledged: 'true' }
}

export async function defaultContact({ contactData }: ConnectRequest): Promise<ConnectResponse> {
  logger.info(\`Unrouted \${contactData.Channel} contact \${contactData.ContactId}\`)
  return {}
}`,
  },
]
</script>

<CodeFileViewer :files="files" id="connect-example" default-file="connect.ts" line-numbers collapse-toggle fixed-height />

The first three routes match a distinct channel, so no contact reaches two of them and the order they
register in makes no difference. `defaultContact` filters on nothing, so it has to come last, and it
catches anything the others miss, such as an outbound voice call.

`index.ts` hands the router to `LambdaRouter`, which is what AWS invokes and what every router in the
Lambda gets registered on. See [routers](/docs/routers) for how the two levels of matching fit
together.
