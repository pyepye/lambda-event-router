# @latcher/lex

Routes Lex V2 code hook calls to handlers by intent, hook and bot. Your handler gets one turn of the conversation and returns the dialog action.

**Supported AWS Services:** `Amazon Lex`

**Available Matchers:** `LexMatcher`

**Docs:** [LexMatcher](https://pyepye.github.io/latcher/matchers/LexMatcher)

## Install

```bash
npm install @latcher/base @latcher/lex
```

`@latcher/base` is a peer dependency, so install it yourself. It exports `Latcher`, which every matcher plugs into.

## Quick Start

```ts
// main handler
import { Latcher } from '@latcher/base'
import { lexMatcher } from './lex'

const latcher = new Latcher({
  matchers: [lexMatcher],
})

export const handler = latcher.handler()
```

```ts
// lex.ts
import { createLexMatcher, defineRoute } from '@latcher/lex'

export const lexMatcher = createLexMatcher()

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

lexMatcher.route(placePizzaOrder)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/latcher/matchers/LexMatcher#annotated-handlers).

## Documentation

- [LexMatcher](https://pyepye.github.io/latcher/matchers/LexMatcher) covers every filter, responses
  and middleware.
- [Handlers](https://pyepye.github.io/latcher/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/lex](../../service-examples/lex) for a deployable app.
