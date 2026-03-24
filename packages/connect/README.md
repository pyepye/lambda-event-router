# @lambda-event-router/connect

Amazon Connect contact flow routing by channel and initiation method.

**Supported AWS Services:** `Amazon Connect`

**Available Routers:** `ConnectRouter`

## Install

```bash
npm install @lambda-event-router/connect
```


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

// Inline functions allows Typescript to automatic infer types
const handleInboundCall = defineRoute({
  filters: {
    channels: ['VOICE'],
    initiationMethods: ['INBOUND'],
  },
}).handle(async ({ contactData }) => {
  console.log(`Inbound voice call from ${contactData.customerEndpoint.address}`)
})
connectRouter.route(handleInboundCall)
```

OR use a the separate syntax to split router and handlers across files:

```ts
// connect.ts
import { createConnectRouter } from '@lambda-event-router/connect'

const connectRouter = createConnectRouter()

// Separate handler to define routes and handlers in different places
connectRouter.voice({
  filters: { initiationMethods: ['INBOUND'] },
  handler: handleInboundCall,
})

// Types do need to be explicitly defined - they can not be inferred by Typescript
export async function handleInboundCall({ contactData }) {
  console.log(`Inbound voice call from ${contactData.customerEndpoint.address}`)
}
```


## Usage

#### Inline handlers

```ts
import { createConnectRouter, defineRoute } from '@lambda-event-router/connect'

const connectRouter = createConnectRouter()

const handleInboundCall = defineRoute({
  filters: {
    channels: ['VOICE'],
    initiationMethods: ['INBOUND'],
  },
}).handle(async ({ contactData }) => {
  console.log(`Inbound voice call from ${contactData.customerEndpoint.address}`)
})

connectRouter.route(handleInboundCall)
```

#### Separate handlers

```ts
import { createConnectRouter } from '@lambda-event-router/connect'

const connectRouter = createConnectRouter()

connectRouter.voice({
  filters: { initiationMethods: ['INBOUND'] },
  handler: handleInboundCall,
})

async function handleInboundCall({ contactData }) {
  console.log(`Inbound voice call from ${contactData.customerEndpoint.address}`)
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
    channels: ['VOICE', 'CHAT', 'TASK'],
    initiationMethods: ['INBOUND', 'OUTBOUND', 'TRANSFER', 'CALLBACK', 'API'],
    customFilter: ({ contactData }) => contactData.queue?.name === 'support',
  },
})
```

## Examples

See the [examples/connect](../../examples/connect) directory for complete working examples.
