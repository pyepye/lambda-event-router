# @lambda-event-router/connect

Routes Amazon Connect contact flow calls to handlers by channel and initiation method. Your handler returns a map of values to the flow.

**Supported AWS Services:** `Amazon Connect`

**Available Routers:** `ConnectRouter`

**Docs:** [ConnectRouter](https://pyepye.github.io/lambda-event-router/routers/ConnectRouter)

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/connect
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.

## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { connectRouter } from './connect'

const lambdaRouter = new LambdaRouter({
  routers: [connectRouter],
})

export const handler = lambdaRouter.handler()
```

```ts
// connect.ts
import { createConnectRouter, defineRoute } from '@lambda-event-router/connect'

export const connectRouter = createConnectRouter()

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

connectRouter.route(greetInboundCaller)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/lambda-event-router/routers/ConnectRouter#annotated-handlers).

## Documentation

- [ConnectRouter](https://pyepye.github.io/lambda-event-router/routers/ConnectRouter) covers every filter, responses
  and middleware.
- [Handlers](https://pyepye.github.io/lambda-event-router/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/connect](../../service-examples/connect) for a deployable app.
