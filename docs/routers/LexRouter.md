# LexRouter

`LexRouter` routes Amazon Lex V2 code hook events to handlers, one turn of the conversation per
invocation.

Lex calls your Lambda twice in a typical turn: a `DialogCodeHook` while it is still gathering slots,
and a `FulfillmentCodeHook` once the intent is ready to complete. Each call carries the intent, its
slots and the transcript of what the user said. The router matches on the intent, the hook and the bot,
then hands your handler the turn to act on and the dialog action to return.

## Install

```bash
npm install @lambda-event-router/lex
```

`@lambda-event-router/base` comes along as a dependency, so you do not need to install it yourself.

## Create the router

```ts
import { createLexRouter } from '@lambda-event-router/lex'
import { logTurn } from './middleware/logTurn'

const lexRouter = createLexRouter({
  middleware: [logTurn],  // Optional
})
```

`createLexRouter()` on its own gives you a router with no shared middleware.

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `middleware` | `LexMiddleware[]` | No | `[]` | Runs for every turn this router handles, before any route middleware. See [Middleware](#middleware) |

## Register routes

```ts
lexRouter.route({
  filters: {
    intentName: 'OrderPizza',
    invocationSource: 'DialogCodeHook',
  },
  middleware: [validateSlots],  // Optional
  handler: gatherPizzaSlots,
})
```

`filters` and `handler` are the only required keys, and `filters` can be an empty object to match every
turn.

`route()` returns the router, so you can chain registrations.

```ts
lexRouter.route(dialogRoute).route(fulfillmentRoute)
```

Routes match in registration order and the first match wins, so give each route filters no other route
can match. See [match order](/docs/routing#match-order) for what goes wrong when they overlap.

**A turn that matches no route throws** `No route matched for Amazon Lex event (intent: ...,
invocationSource: ...)`. Lex expects a response, so an unmatched turn fails the invocation and the bot
falls back to its configured error handling rather than continuing the conversation. Register a
filter-less catch-all last if you would rather answer everything else in one place, and see [nothing
matched](/docs/routing#nothing-matched) for what the other routers do instead.

A Lex turn carries the intent and slots Lex has already parsed rather than a payload you control, so
there is nothing to validate and no schema validation section on this page.

### Convenience methods

`dialogCodeHook` and `fulfillmentCodeHook` each preset the `invocationSource` filter for one of the two
hooks, so you register with the rest of the filters and the method fills in the hook.

```ts
lexRouter.fulfillmentCodeHook({
  filters: { intentName: 'OrderPizza' },
  handler: placePizzaOrder,
})

// The same route through route()
lexRouter.route({
  filters: { intentName: 'OrderPizza', invocationSource: 'FulfillmentCodeHook' },
  handler: placePizzaOrder,
})
```

| Method | Presets |
| --- | --- |
| `dialogCodeHook` | `invocationSource: 'DialogCodeHook'` |
| `fulfillmentCodeHook` | `invocationSource: 'FulfillmentCodeHook'` |

Each method also narrows the handler type to that hook, so `fulfillmentCodeHook` types its handler
against `LexFulfillmentCodeHookRequest`. The method sets `invocationSource` itself and its filters type
omits that key, so you pick the hook through the method and passing `invocationSource` in `filters` is a
type error. See [convenience methods](/docs/routing#convenience-methods) for how the other routers use
them.

## Filters

Every filter key on one route, showing each form a value can take. All of them are optional, so set the
ones that pick out the turns you want and leave the rest off.

```ts
lexRouter.route({
  filters: {
    intentName: 'OrderPizza', // Or a pattern: /^Order/
    invocationSource: ['DialogCodeHook', 'FulfillmentCodeHook'],
    botId: 'ABCDEF1234',
    inputMode: ['Text', 'Speech', 'DTMF'],
    custom: ({ event }) => event.sessionState.sessionAttributes?.tier === 'premium',
  },
  handler: routeTurn,
})
```

| Filter | Type | Description |
| --- | --- | --- |
| `intentName` | `FilterStringMatcher` | Matches the name of the intent Lex resolved for this turn |
| `invocationSource` | `LexInvocationSource \| LexInvocationSource[]` | Exact match against the hook: `DialogCodeHook` or `FulfillmentCodeHook`. Not a pattern, so list both to match either |
| `botId` | `FilterStringMatcher` | Matches the id of the bot the turn came from |
| `inputMode` | `LexInputMode \| LexInputMode[]` | Exact match against how the user replied: `Text`, `Speech` or `DTMF`. Not a pattern, so list every mode you want |
| `custom` | `(input: LexFilterInput) => boolean \| Promise<boolean>` | Given the intent name, hook, input mode, bot id and the raw event. Anything the other filters cannot express. Can be async |

`intentName` and `botId` are `FilterStringMatcher`, which is `string | RegExp | Array<string |
RegExp>`. `invocationSource` and `inputMode` are exact-match unions, not patterns, so a value has to be
one of the ones listed. See [filters](/docs/routing#filters) for how each form matches, including the
`*` wildcard.

**`custom` is the only filter that reaches the whole event.** Its `event` is the typed
`LexV2Event`, so use it to match on a session attribute, an active context or a slot value that no
built-in key covers. See [`custom`](/docs/routing#custom) for where it sits in the filter
order.

## Handler

Handlers take one argument and return the dialog action for Lex to run next.

```ts
import { logger } from '@lambda-event-router/base'
import type { LexRequest, LexResponse } from '@lambda-event-router/lex'

export async function placePizzaOrder({ intentName, slots }: LexRequest): Promise<LexResponse> {
  logger.info(`Fulfilling ${intentName} with slots ${JSON.stringify(slots)}`)
  return {
    sessionState: {
      dialogAction: { type: 'Close' },
      intent: { name: intentName, state: 'Fulfilled' },
    },
    messages: [{ contentType: 'PlainText', content: 'Your pizza is on its way!' }],
  }
}
```

### Request object

| Field | Type | Description |
| --- | --- | --- |
| `intentName` | `string` | The name of the intent Lex resolved for this turn |
| `slots` | `LexV2Slots` | The slots Lex has parsed so far, keyed by slot name. A slot Lex has not filled yet is `null` |
| `invocationSource` | `LexInvocationSource` | The hook that fired, `DialogCodeHook` or `FulfillmentCodeHook` |
| `sessionAttributes` | `Record<string, string>` | The session attributes carried across turns, or `{}` when the session has none |
| `inputTranscript` | `string` | The text of what the user said, or a transcription of their speech |
| `bot` | `LexV2Bot` | The bot the turn came from: its id, name, alias and locale |
| `event` | `LexV2Event` | The untouched event from AWS |
| `context` | `Context` | The Lambda context |

`LexV2Event`, `LexV2Slots`, `LexV2Bot` and `Context` come from `aws-lambda`, not this package.

### Response type

`LexResponse` is `LexV2Result`, the session state and messages Lex uses to drive the next turn. See
[Responses](#responses) for what Lex does with it and the shape it has to be in.

### Inferred handlers

`defineRoute` types the handler from the router, so you get `intentName`, `slots`, `invocationSource`
and the rest without naming `LexRequest` anywhere.

```ts
import { logger } from '@lambda-event-router/base'
import { defineRoute } from '@lambda-event-router/lex'

export const placePizzaOrder = defineRoute({
  filters: { intentName: 'OrderPizza', invocationSource: 'FulfillmentCodeHook' },
}).handle(async ({ intentName, slots }) => {
  logger.info(`Fulfilling ${intentName} with slots ${JSON.stringify(slots)}`)
  return {
    sessionState: {
      dialogAction: { type: 'Close' },
      intent: { name: intentName, state: 'Fulfilled' },
    },
    messages: [{ contentType: 'PlainText', content: 'Your pizza is on its way!' }],
  }
})

lexRouter.route(placePizzaOrder)
```

Not having to name the request shape pays off most in a Lambda taking several event sources, since
every router hands its handler something different. See [inferred
handlers](/docs/handlers#inferred-handlers), where the same source is written both ways to compare.

### Annotated handlers

Annotating the request yourself splits route setup from business logic, using
[`LexFulfillmentCodeHookRequest`](#types) for a handler pinned to one hook or [`LexRequest`](#types) for
one that takes either.

```ts
// handlers/placePizzaOrder.ts
import { logger } from '@lambda-event-router/base'
import type { LexFulfillmentCodeHookRequest, LexResponse } from '@lambda-event-router/lex'

export async function placePizzaOrder(
  { intentName, slots }: LexFulfillmentCodeHookRequest,
): Promise<LexResponse> {
  logger.info(`Fulfilling ${intentName} with slots ${JSON.stringify(slots)}`)
  return {
    sessionState: {
      dialogAction: { type: 'Close' },
      intent: { name: intentName, state: 'Fulfilled' },
    },
    messages: [{ contentType: 'PlainText', content: 'Your pizza is on its way!' }],
  }
}
```

```ts
// lex.ts
import { createLexRouter } from '@lambda-event-router/lex'
import { placePizzaOrder } from './handlers/placePizzaOrder'

const lexRouter = createLexRouter()

lexRouter.fulfillmentCodeHook({
  filters: { intentName: 'OrderPizza' },
  handler: placePizzaOrder,
})
```

A handler typed to one hook fits that hook's convenience method, not `route()`. `route()` types its
handler against the wide `LexRequest` union, so a function narrowed to `LexFulfillmentCodeHookRequest`
will not assign to it. Register such a handler through `fulfillmentCodeHook()`, or annotate against
`LexRequest` and read `invocationSource` inside. There is no schema, so nothing to derive with
`z.infer`. See [annotated handlers](/docs/handlers#annotated-handlers) for the worked version.

## Responses

Your handler returns a `LexV2Result` and the router hands it straight back to Lex, so the return shape
is Lex's contract rather than the router's. Lex reads the `dialogAction` to decide what happens next and
sends any `messages` to the user.

```ts
return {
  sessionState: {
    dialogAction: { type: 'ElicitSlot', slotToElicit: 'PizzaSize' },
    intent: { name: 'OrderPizza', state: 'InProgress' },
    sessionAttributes: { tier: 'premium' }, // Optional, carried into the next turn
  },
  messages: [{ contentType: 'PlainText', content: 'What size would you like?' }],
}
```

`sessionState.dialogAction.type` is the one field Lex always needs. It drives the conversation:

| `dialogAction.type` | What Lex does next |
| --- | --- |
| `Delegate` | Decides the next step itself from the bot's configuration |
| `ElicitSlot` | Asks the user for the slot named in `slotToElicit` |
| `ElicitIntent` | Asks the user what they want to do |
| `ConfirmIntent` | Asks the user to confirm the intent before fulfilling it |
| `Close` | Ends the intent, usually paired with `intent.state: 'Fulfilled'` or `'Failed'` |

`ElicitSlot` is the only type that takes a `slotToElicit`. `intent.state` reports where the intent has
got to, one of `Fulfilled`, `InProgress`, `Failed`, `ReadyForFulfillment`, `FulfillmentInProgress` or
`Waiting`. `messages` is optional, and each message is `PlainText`, `SSML`, `CustomPayload` or an
`ImageResponseCard`.

The full response contract is Lex's, and the
[Lex V2 Lambda reference](https://docs.aws.amazon.com/lexv2/latest/dg/lambda-response-format.html)
covers every field. **Throwing from a handler, timing out or returning a shape Lex cannot read fails the
invocation**, which Lex surfaces to the user through its fallback intent. An unmatched turn throws, so
it lands there too.

## Middleware

Router and route middleware are both typed `LexMiddleware`, and the chain runs once per turn.

```ts
import { logger } from '@lambda-event-router/base'
import type { LexMiddleware } from '@lambda-event-router/lex'

export const logTurn: LexMiddleware = async (request, next) => {
  logger.info(`Handling ${request.intentName} (${request.invocationSource}) on bot ${request.bot.id}`)
  return next(request)
}
```

```ts
const lexRouter = createLexRouter({ middleware: [logTurn] })

lexRouter.route({
  filters: { intentName: 'OrderPizza' },
  middleware: [validateSlots],
  handler: gatherPizzaSlots,
})
```

Router middleware runs before route middleware. See [middleware](/docs/middleware) for the execution
order and the three levels it attaches at.

## Types

All exported from `@lambda-event-router/lex`.

| Type | Description |
| --- | --- |
| `LexRequest` | The wide handler argument, a union over both hooks |
| `LexDialogCodeHookRequest` | The handler argument for a `DialogCodeHook` route |
| `LexFulfillmentCodeHookRequest` | The handler argument for a `FulfillmentCodeHook` route |
| `LexResponse` | Handler return type, `LexV2Result` |
| `LexHandler` | The wide handler, `(request: LexRequest) => Promise<LexResponse>` |
| `LexDialogCodeHookHandler` | A handler pinned to `DialogCodeHook` |
| `LexFulfillmentCodeHookHandler` | A handler pinned to `FulfillmentCodeHook` |
| `LexFilters` | The `filters` object |
| `LexFilterInput` | What `custom` receives |
| `LexInvocationSource` | `'DialogCodeHook' \| 'FulfillmentCodeHook'` |
| `LexInputMode` | `'DTMF' \| 'Speech' \| 'Text'` |
| `LexMiddleware` | Router and route middleware |
| `LexRouteDefinition` | A full route passed to `route()` |
| `LexDialogCodeHookRouteDefinition` | A route passed to `dialogCodeHook()` |
| `LexFulfillmentCodeHookRouteDefinition` | A route passed to `fulfillmentCodeHook()` |
| `LexDialogCodeHookFilters` | The `filters` for `dialogCodeHook()` |
| `LexFulfillmentCodeHookFilters` | The `filters` for `fulfillmentCodeHook()` |
| `LexRouterOptions` | Options for `createLexRouter` |

The `LexRouter` class and the `createLexRouter` and `defineRoute` functions come from the same place.

No Lex type takes a generic parameter. The request and response shapes are fixed by the event, so there
is no `### Generic parameters` table that a reader arriving from another router might expect.

## Code example

One Lambda driving a pizza-ordering bot: validating slots during the dialog, placing the order on
fulfilment, and a catch-all that re-asks for anything it does not recognise.

Open a file: [index.ts](#lex-example:index.ts) | [Lex router](#lex-example:lex.ts) | [handlers](#lex-example:handlers/pizza.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { lexRouter } from './lex.js'

const lambdaRouter = new LambdaRouter({
  routers: [lexRouter],
})

export const handler: Handler = lambdaRouter.handler()`,
  },
  {
    path: 'lex.ts',
    code: `import { createLexRouter } from '@lambda-event-router/lex'

import { elicitIntent, gatherPizzaSlots, placePizzaOrder } from './handlers/pizza.js'

export const lexRouter = createLexRouter()

lexRouter
  .dialogCodeHook({
    filters: { intentName: 'OrderPizza' },
    handler: gatherPizzaSlots,
  })
  .fulfillmentCodeHook({
    filters: { intentName: 'OrderPizza' },
    handler: placePizzaOrder,
  })
  .route({ filters: {}, handler: elicitIntent })`,
  },
  {
    path: 'handlers/pizza.ts',
    code: `import { logger } from '@lambda-event-router/base'
import type { LexDialogCodeHookRequest, LexFulfillmentCodeHookRequest, LexRequest, LexResponse } from '@lambda-event-router/lex'

export async function gatherPizzaSlots(
  { intentName, slots }: LexDialogCodeHookRequest,
): Promise<LexResponse> {
  logger.info(\`Gathering slots for \${intentName}: \${JSON.stringify(slots)}\`)
  if (!slots.PizzaSize) {
    return {
      sessionState: {
        dialogAction: { type: 'ElicitSlot', slotToElicit: 'PizzaSize' },
        intent: { name: intentName, state: 'InProgress' },
      },
      messages: [{ contentType: 'PlainText', content: 'What size would you like?' }],
    }
  }
  return {
    sessionState: {
      dialogAction: { type: 'Delegate' },
      intent: { name: intentName, state: 'InProgress' },
    },
  }
}

export async function placePizzaOrder(
  { intentName, slots }: LexFulfillmentCodeHookRequest,
): Promise<LexResponse> {
  logger.info(\`Placing \${intentName} order: \${JSON.stringify(slots)}\`)
  return {
    sessionState: {
      dialogAction: { type: 'Close' },
      intent: { name: intentName, state: 'Fulfilled' },
    },
    messages: [{ contentType: 'PlainText', content: 'Your pizza is on its way!' }],
  }
}

export async function elicitIntent({ intentName }: LexRequest): Promise<LexResponse> {
  logger.info(\`Unrouted intent \${intentName}\`)
  return {
    sessionState: { dialogAction: { type: 'ElicitIntent' } },
    messages: [{ contentType: 'PlainText', content: 'Sorry, what would you like to order?' }],
  }
}`,
  },
]
</script>

<CodeFileViewer :files="files" id="lex-example" default-file="lex.ts" line-numbers collapse-toggle fixed-height />

The two `OrderPizza` routes match a different hook, so no turn reaches both and the order they register
in makes no difference. `elicitIntent` filters on nothing, so it has to come last, and it catches any
other intent Lex sends.

`index.ts` hands the router to `LambdaRouter`, which is what AWS invokes and what every router in the
Lambda gets registered on. See [routers](/docs/routers) for how the two levels of matching fit together.
