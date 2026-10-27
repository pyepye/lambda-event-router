# ConnectMatcher

`ConnectMatcher` routes Amazon Connect contact flow events to handlers, one contact per invocation.

Connect calls your Lambda from an Invoke AWS Lambda function block in a contact flow. Each call carries
one contact, with the channel it came in on and the method that started it. The matcher matches on those
and hands your handler the contact to act on and a map of values to return to the flow.

## Install

```bash
npm install @latcher/base @latcher/connect
```

`@latcher/base` is a peer dependency, so install it yourself. It exports
`Latcher`, which every matcher plugs into.

## Create the matcher

```ts
import { createConnectMatcher } from '@latcher/connect'
import { logInvocation } from './middleware/logInvocation'

const connectMatcher = createConnectMatcher({
  middleware: [logInvocation],  // Optional
})
```

`createConnectMatcher()` on its own gives you a matcher with no shared middleware.

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `middleware` | `ConnectMiddleware[]` | No | `[]` | Runs for every contact this matcher handles, before any route middleware. See [Middleware](#middleware) |

## Register routes

```ts
connectMatcher.route({
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

`route()` returns the matcher, so you can chain registrations.

```ts
connectMatcher.route(inboundVoiceRoute).route(chatRoute)
```

Routes are ranked by how specific they are. Where two overlap, the one matching only a subset of the
other is tried first, whatever order you registered them in. Registration order decides the rest, so give
each route filters no other route can match. See [match order](/docs/routing#match-order) for how ranking
works and what it cannot settle.

**A contact that matches no route throws** `No route matched for Amazon Connect event (channel: ...,
initiationMethod: ...)`. Connect expects a response, so an unmatched contact fails the invocation and the
flow takes the Error branch of the block rather than falling through. Register a filter-less catch-all if
you would rather handle everything else in one place. It ranks last on its own, so it takes what the
other routes turn down. See [nothing matched](/docs/routing#nothing-matched) for what the other matchers
do instead.

A contact carries metadata about a call or chat rather than a payload you control, so there is nothing
to validate and no schema validation section on this page.

### Convenience methods

Each convenience method presets one filter key, so you register with the rest of the filters and the
method fills in the channel or the initiation method.

```ts
connectMatcher.voice({
  filters: { initiationMethod: 'INBOUND' },
  handler: greetInboundCaller,
})

// The same route through route()
connectMatcher.route({
  filters: { channel: 'VOICE', initiationMethod: 'INBOUND' },
  handler: greetInboundCaller,
})
```

| Method | Presets |
| --- | --- |
| `voice` | `channel: 'VOICE'` |
| `chat` | `channel: 'CHAT'` |
| `email` | `channel: 'EMAIL'` |
| `task` | `channel: 'TASK'` |
| `inbound` | `initiationMethod: 'INBOUND'` |
| `outbound` | `initiationMethod: 'OUTBOUND'` |
| `transfer` | `initiationMethod: 'TRANSFER'` |
| `callback` | `initiationMethod: 'CALLBACK'` |
| `api` | `initiationMethod: 'API'` |

A channel method still takes an `initiationMethod` filter and the reverse, so
`voice({ filters: { initiationMethod: 'INBOUND' } })` matches inbound voice contacts. A channel
method's filters omit `channel` and an initiation-method method's omit `initiationMethod`, so the key
the method presets is set through the method and passing it in `filters` is a type error. See
[convenience methods](/docs/routing#convenience-methods) for how the other matchers use them.

## Filters

Every filter key on one route, showing each form a value can take. All of them are optional, so set the
ones that pick out the contacts you want and leave the rest off.

```ts
connectMatcher.route({
  filters: {
    channel: ['VOICE', 'CHAT', 'EMAIL', 'TASK'],
    initiationMethod: ['INBOUND', 'OUTBOUND', 'TRANSFER', 'CALLBACK', 'API'],
    instanceArn: CONNECT_INSTANCE_ARN, // Or a pattern: /:instance\//
    custom: ({ event }) => event.Details.ContactData.Queue?.Name === 'support',
  },
  handler: routeContact,
})
```

| Filter | Type | Description |
| --- | --- | --- |
| `channel` | `ConnectChannel \| ConnectChannel[]` | Exact match against the contact's channel, one of `VOICE`, `CHAT`, `EMAIL` or `TASK`. Not a pattern, so list every channel you want |
| `initiationMethod` | `ConnectInitiationMethod \| ConnectInitiationMethod[]` | Exact match against how the contact started, such as `INBOUND`, `API` or `WEBRTC_API`. See [Types](#types) for all twelve |
| `instanceArn` | `FilterStringMatcher` | Matches the ARN of the Connect instance the contact belongs to |
| `custom` | `(input: ConnectFilterInput) => boolean \| Promise<boolean>` | Given the channel, the initiation method and the raw event. Anything the other filters cannot express. Can be async |

`channel` and `initiationMethod` are exact-match unions, not patterns, so a value has to be one of the
ones listed. Only `instanceArn` is a `FilterStringMatcher`, which is `string | RegExp | Array<string |
RegExp>`. See [filters](/docs/routing#filters) for how each form matches, including the `*` wildcard.

**Both unions are declared by this package rather than taken from `aws-lambda`.** The `aws-lambda`
types are narrower than the Connect service model: they omit the `TASK` channel and seven initiation
methods, so a contact that arrives on one of those could not be named in a filter. `ConnectChannel`
and `ConnectInitiationMethod` follow the service model instead. `ConnectRequest.contactData` and
`ConnectRequest.event` are retyped to match, so a handler reading `contactData.Channel` sees the same
four values a filter can name.

**`custom` is the only filter that reaches the whole event.** Its `event` is the typed
`ConnectEvent`, so use it to match on the queue, customer endpoint or a contact attribute that no
built-in key covers. See [`custom`](/docs/routing#custom) for where it sits in the
filter order.

## Handler

Handlers take one argument and return a map of values for the flow.

```ts
import { logger } from '@latcher/base'
import type { ConnectRequest, ConnectResponse } from '@latcher/connect'

export async function greetInboundCaller({ contactData }: ConnectRequest): Promise<ConnectResponse> {
  logger.info(`Inbound voice contact ${contactData.ContactId} from ${contactData.CustomerEndpoint?.Address}`)
  return { greeting: 'Welcome back' }
}
```

### Request object

| Field | Type | Description |
| --- | --- | --- |
| `contactData` | `ConnectContactData` | The contact: its channel, initiation method, queue, customer endpoint, saved attributes and the rest |
| `parameters` | `Record<string, string>` | The key/value parameters set on the Invoke AWS Lambda function block for this call |
| `event` | `ConnectEvent` | The event from AWS, with the channel and initiation method widened |
| `context` | `Context` | The Lambda context |

`Context` comes from `aws-lambda`, not this package. `contactData` and `parameters` are the
`Details.ContactData` and `Details.Parameters` off `event`.

### Response type

`ConnectResponse` is `ConnectContactFlowResult`, a flat map of string values. See
[Responses](#responses) for what Connect does with it and the shape it has to be in.

### Inferred handlers

`defineRoute` types the handler from the matcher, so you get `contactData`, `parameters`, `event` and
`context` without naming `ConnectRequest` anywhere.

```ts
import { logger } from '@latcher/base'
import { defineRoute } from '@latcher/connect'

export const greetInboundCaller = defineRoute({
  filters: { channel: 'VOICE', initiationMethod: 'INBOUND' },
}).handle(async ({ contactData }) => {
  logger.info(`Inbound voice contact ${contactData.ContactId}`)
  return { greeting: 'Welcome back' }
})

connectMatcher.route(greetInboundCaller)
```

Not having to name the request shape pays off most in a Lambda taking several event sources, since
every matcher hands its handler something different. See [inferred
handlers](/docs/handlers#inferred-handlers), where the same source is written both ways to compare.

### Annotated handlers

Annotating the request yourself splits route setup from business logic, using
[`ConnectRequest`](#types) as the argument type.

```ts
// handlers/greetInboundCaller.ts
import { logger } from '@latcher/base'
import type { ConnectRequest, ConnectResponse } from '@latcher/connect'

export async function greetInboundCaller({ contactData }: ConnectRequest): Promise<ConnectResponse> {
  logger.info(`Inbound voice contact ${contactData.ContactId}`)
  return { greeting: 'Welcome back' }
}
```

```ts
// connect.ts
import { createConnectMatcher } from '@latcher/connect'
import { greetInboundCaller } from './handlers/greetInboundCaller'

const connectMatcher = createConnectMatcher()

connectMatcher.voice({
  filters: { initiationMethod: 'INBOUND' },
  handler: greetInboundCaller,
})
```

`ConnectRequest` is the whole request type. There is no schema and no generic parameter, so nothing to
derive with `z.infer` and nothing to keep in sync. A handler typed `ConnectRequest` fits every
registration form, `route()` and each convenience method, since they all take the same handler
signature. See [annotated handlers](/docs/handlers#annotated-handlers) for the worked version.

## Responses

Your handler returns a flat object of string key/value pairs and the matcher hands it straight back to
Connect, so `ConnectResponse` is `ConnectContactFlowResult`, `Record<string, string | null>`. The
return shape is Connect's contract rather than the matcher's.

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
when the block is set to JSON validation instead. The returned data has to be under 32 KB, and Connect
documents the values as alphanumeric, dash and underscore only.

**Throwing from a handler, timing out or returning something Connect cannot read sends the contact down
the Error branch of the block.** An unmatched contact throws, so it lands there too.

## Middleware

Matcher and route middleware are both typed `ConnectMiddleware`, and the chain runs once per contact.

```ts
import { logger } from '@latcher/base'
import type { ConnectMiddleware } from '@latcher/connect'

export const logInvocation: ConnectMiddleware = async (request, next) => {
  logger.info(`Handling ${request.contactData.Channel} contact ${request.contactData.ContactId}`)
  return next(request)
}
```

```ts
const connectMatcher = createConnectMatcher({ middleware: [logInvocation] })

connectMatcher.route({
  filters: { channel: 'VOICE' },
  middleware: [withContactContext],
  handler: routeContact,
})
```

Matcher middleware runs before route middleware. See [middleware](/docs/middleware) for the execution
order and the three levels it attaches at.

## Types

All exported from `@latcher/connect`.

| Type | Description |
| --- | --- |
| `ConnectRequest` | The handler argument |
| `ConnectResponse` | Handler return type, `ConnectContactFlowResult` |
| `ConnectHandler` | The handler function, `(request: ConnectRequest) => Promise<ConnectResponse>` |
| `ConnectFilters` | The `filters` object |
| `ConnectFilterInput` | What `custom` receives |
| `ConnectChannel` | `'CHAT' \| 'EMAIL' \| 'TASK' \| 'VOICE'` |
| `ConnectInitiationMethod` | `'AGENT_REPLY' \| 'API' \| 'CALLBACK' \| 'DISCONNECT' \| 'EXTERNAL_OUTBOUND' \| 'FLOW' \| 'INBOUND' \| 'MONITOR' \| 'OUTBOUND' \| 'QUEUE_TRANSFER' \| 'TRANSFER' \| 'WEBRTC_API'` |
| `ConnectEvent` | The contact flow event, with `Channel` and `InitiationMethod` widened |
| `ConnectContactData` | `Details.ContactData` off `ConnectEvent` |
| `ConnectMiddleware` | Matcher and route middleware |
| `ConnectRouteDefinition` | A full route passed to `route()` |
| `ConnectChannelRouteDefinition` | A route passed to a channel method |
| `ConnectInitiationMethodRouteDefinition` | A route passed to an initiation-method method |
| `ConnectChannelFilters` | The `filters` for a channel method |
| `ConnectInitiationMethodFilters` | The `filters` for an initiation-method method |
| `ConnectMatcherOptions` | Options for `createConnectMatcher` |

The `ConnectMatcher` class and the `createConnectMatcher` and `defineRoute` functions come from the same
place.

No Connect type takes a generic parameter. The request and response shapes are fixed by the event, so
there is no `### Generic parameters` table that a reader arriving from another matcher might expect.

## Code example

One Lambda fronting a contact centre: greeting inbound voice callers, answering chats and emails, and a
catch-all for everything else.

Open a file: [index.ts](#connect-example:index.ts) | [Connect matcher](#connect-example:connect.ts) | [handlers](#connect-example:handlers/contacts.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { Latcher } from '@latcher/base'

import { connectMatcher } from './connect.js'

const latcher = new Latcher({
  matchers: [connectMatcher],
})

export const handler: Handler = latcher.handler()`,
  },
  {
    path: 'connect.ts',
    code: `import { createConnectMatcher } from '@latcher/connect'

import { defaultContact, greetInboundCaller, handleChat, handleEmail } from './handlers/contacts.js'

export const connectMatcher = createConnectMatcher()

connectMatcher
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
    code: `import { logger } from '@latcher/base'
import type { ConnectRequest, ConnectResponse } from '@latcher/connect'

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

`index.ts` hands the matcher to `Latcher`, which is what AWS invokes and what every matcher in the
Lambda gets registered on. See [matchers](/docs/matchers) for how the two levels of matching fit
together.
