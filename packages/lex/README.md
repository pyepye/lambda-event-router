# @lambda-event-router/lex

Amazon Lex V2 dialog and fulfillment code hook routing.

**Supported AWS Services:** `Amazon Lex`

**Available Routers:** `LexRouter`

## Install

```bash
npm install @lambda-event-router/lex
```


## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { lexRouter } from './lex'

const lambdaRouter = new LambdaRouter({
  routers: [lexRouter]
})

export const handler = lambdaRouter.handler()
```

```ts
// lex.ts
import { createLexRouter, defineRoute } from '@lambda-event-router/lex'

const lexRouter = createLexRouter()

// Inline handlers let TypeScript infer the request type
const handleFulfillment = defineRoute({
  filters: {
    invocationSource: 'FulfillmentCodeHook',
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
lexRouter.route(handleFulfillment)
```

Or use the separate syntax to split router and handlers across files:

```ts
// lex.ts
import { createLexRouter } from '@lambda-event-router/lex'
import type { LexFulfillmentCodeHookRequest, LexResponse } from '@lambda-event-router/lex'

const lexRouter = createLexRouter()

lexRouter.fulfillmentCodeHook({
  filters: {},
  handler: handleFulfillment,
})

// A separate handler needs its request type annotated - it cannot be inferred
async function handleFulfillment({ intentName, inputTranscript }: LexFulfillmentCodeHookRequest): Promise<LexResponse> {
  console.log(`Fulfilling ${intentName}: ${inputTranscript}`)
  return {
    sessionState: {
      dialogAction: { type: 'Close' },
      intent: { name: intentName, state: 'Fulfilled' },
    },
  }
}
```


## Usage

#### Inline handlers

```ts
import { createLexRouter, defineRoute } from '@lambda-event-router/lex'

const lexRouter = createLexRouter()

const handleFulfillment = defineRoute({
  filters: {
    invocationSource: 'FulfillmentCodeHook',
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

lexRouter.route(handleFulfillment)
```

#### Separate handlers

```ts
import { createLexRouter } from '@lambda-event-router/lex'
import type { LexFulfillmentCodeHookRequest, LexResponse } from '@lambda-event-router/lex'

const lexRouter = createLexRouter()

lexRouter.fulfillmentCodeHook({
  filters: {},
  handler: handleFulfillment,
})

async function handleFulfillment({ intentName, inputTranscript }: LexFulfillmentCodeHookRequest): Promise<LexResponse> {
  console.log(`Fulfilling ${intentName}: ${inputTranscript}`)
  return {
    sessionState: {
      dialogAction: { type: 'Close' },
      intent: { name: intentName, state: 'Fulfilled' },
    },
  }
}
```

#### Helper methods

`dialogCodeHook` and `fulfillmentCodeHook` preset the `invocationSource` filter for you, so you only pass
the rest of the filters and a handler.

```ts
lexRouter.dialogCodeHook({
  filters: { intentName: 'OrderPizza' },
  handler: validateSlots,
})

lexRouter.fulfillmentCodeHook({
  filters: { intentName: 'OrderPizza' },
  handler: placeOrder,
})
```

#### Filters

```ts
defineRoute({
  filters: {
    inputMode: ['Text', 'Speech'],
    invocationSource: ['DialogCodeHook', 'FulfillmentCodeHook'],
    custom: ({ event }) => event.sessionState.sessionAttributes?.tier === 'premium',
  },
})
```

## Examples

See the [examples/lex](../../examples/lex) directory for complete working examples.
