# @lambda-event-router/lex

Routes Lex V2 code hook calls to handlers by intent, hook and bot. Your handler gets one turn of the conversation and returns the dialog action.

**Supported AWS Services:** `Amazon Lex`

**Available Routers:** `LexRouter`

**Docs:** [LexRouter](https://pyepye.github.io/lambda-event-router/routers/LexRouter)

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/lex
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.

## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { lexRouter } from './lex'

const lambdaRouter = new LambdaRouter({
  routers: [lexRouter],
})

export const handler = lambdaRouter.handler()
```

```ts
// lex.ts
import { createLexRouter, defineRoute } from '@lambda-event-router/lex'

export const lexRouter = createLexRouter()

const placePizzaOrder = defineRoute({
  filters: {
    intentName: 'OrderPizza',
    invocationSource: 'FulfillmentCodeHook',
    botId: 'ABCDEF1234',
    inputMode: 'Text',
  },
}).handle(async ({ intentName, inputTranscript }) => {
  console.log(`Fulfilling ${intentName}: ${inputTranscript}`)
  return {
    sessionState: {
      dialogAction: { type: 'Close' },
      intent: { name: intentName, state: 'Fulfilled' },
    },
  }
})

lexRouter.route(placePizzaOrder)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/lambda-event-router/routers/LexRouter#annotated-handlers).

## Documentation

- [LexRouter](https://pyepye.github.io/lambda-event-router/routers/LexRouter) covers every filter, responses
  and middleware.
- [Handlers](https://pyepye.github.io/lambda-event-router/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/lex](../../service-examples/lex) for a deployable app.
