# @latcher/connect

Routes Amazon Connect contact flow calls to handlers by channel and initiation method. Your handler returns a map of values to the flow.

**Supported AWS Services:** `Amazon Connect`

**Available Matchers:** `ConnectMatcher`

**Docs:** [ConnectMatcher](https://pyepye.github.io/latcher/matchers/ConnectMatcher)

## Install

```bash
npm install @latcher/base @latcher/connect
```

`@latcher/base` is a peer dependency, so install it yourself. It exports `Latcher`, which every matcher plugs into.

## Quick Start

```ts
// main handler
import { Latcher } from '@latcher/base'
import { connectMatcher } from './connect'

const latcher = new Latcher({
  matchers: [connectMatcher],
})

export const handler = latcher.handler()
```

```ts
// connect.ts
import { createConnectMatcher, defineRoute } from '@latcher/connect'

export const connectMatcher = createConnectMatcher()

const greetInboundCaller = defineRoute({
  filters: {
    channel: 'VOICE',
    initiationMethod: 'INBOUND',
    instanceArn: 'arn:aws:connect:eu-west-2:123456789012:instance/abcd1234-ab12-cd34-ef56-abcdef123456',
  },
}).handle(async ({ contactData }) => {
  console.log(`Inbound call from ${contactData.CustomerEndpoint?.Address}`)
  return { greeting: 'Welcome back' }
})

connectMatcher.route(greetInboundCaller)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/latcher/matchers/ConnectMatcher#annotated-handlers).

## Documentation

- [ConnectMatcher](https://pyepye.github.io/latcher/matchers/ConnectMatcher) covers every filter, responses
  and middleware.
- [Handlers](https://pyepye.github.io/latcher/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/connect](../../service-examples/connect) for a deployable app.
