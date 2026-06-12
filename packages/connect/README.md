# @lambda-event-router/connect

Amazon Connect contact flow routing by channel and initiation method.

**Supported AWS Services:** `Amazon Connect`

**Available Routers:** `ConnectRouter`

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
  routers: [connectRouter]
})

export const handler = lambdaRouter.handler()
```

```ts
// connect.ts
import { createConnectRouter, defineRoute } from '@lambda-event-router/connect'

const connectRouter = createConnectRouter()

// An inline handler lets TypeScript infer the request type
const handleInboundCall = defineRoute({
  filters: {
    channel: 'VOICE',
    initiationMethod: 'INBOUND',
  },
}).handle(async ({ contactData }) => {
  console.log(`Inbound voice call from ${contactData.CustomerEndpoint?.Address}`)
})
connectRouter.route(handleInboundCall)
```

OR use a the separate syntax to split router and handlers across files:

```ts
// connect.ts
import { createConnectRouter } from '@lambda-event-router/connect'
import type { ConnectRequest } from '@lambda-event-router/connect'

const connectRouter = createConnectRouter()

// Separate handler to define routes and handlers in different places
connectRouter.voice({
  filters: { initiationMethod: 'INBOUND' },
  handler: handleInboundCall,
})

// A separate handler has to be typed with ConnectRequest
export async function handleInboundCall({ contactData }: ConnectRequest) {
  console.log(`Inbound voice call from ${contactData.CustomerEndpoint?.Address}`)
}
```


## Usage

#### Inline handlers

```ts
import { createConnectRouter, defineRoute } from '@lambda-event-router/connect'

const connectRouter = createConnectRouter()

const handleInboundCall = defineRoute({
  filters: {
    channel: 'VOICE',
    initiationMethod: 'INBOUND',
  },
}).handle(async ({ contactData }) => {
  console.log(`Inbound voice call from ${contactData.CustomerEndpoint?.Address}`)
})

connectRouter.route(handleInboundCall)
```

#### Separate handlers

```ts
import { createConnectRouter } from '@lambda-event-router/connect'
import type { ConnectRequest } from '@lambda-event-router/connect'

const connectRouter = createConnectRouter()

connectRouter.voice({
  filters: { initiationMethod: 'INBOUND' },
  handler: handleInboundCall,
})

async function handleInboundCall({ contactData }: ConnectRequest) {
  console.log(`Inbound voice call from ${contactData.CustomerEndpoint?.Address}`)
}
```

#### Helper methods

```ts
// Channels
connectRouter.voice()
connectRouter.chat()
connectRouter.email()

// Initiation methods
connectRouter.inbound()
connectRouter.outbound()
connectRouter.transfer()
connectRouter.callback()
connectRouter.api()
```

#### Filters

```ts
defineRoute({
  filters: {
    channel: ['VOICE', 'CHAT', 'EMAIL'],
    initiationMethod: ['INBOUND', 'OUTBOUND', 'TRANSFER', 'CALLBACK', 'API'],
    custom: ({ event }) => event.Details.ContactData.Queue?.Name === 'support',
  },
})
```

## Examples

See the [examples/connect](../../examples/connect) directory for complete working examples.
