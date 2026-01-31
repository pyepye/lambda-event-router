# @lambda-event-router/ses

SES email receipt routing by receipt status.

**Supported AWS Services:** `Amazon SES`

**Available Routers:** `SESRouter`

## Install

```bash
npm install @lambda-event-router/ses
```


## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { sesRouter } from './ses'

const lambdaRouter = new LambdaRouter({
  routers: [sesRouter]
})

export const handler = lambdaRouter.handler()
```

```ts
// ses.ts
import { createSESRouter, defineRoute } from '@lambda-event-router/ses'

const sesRouter = createSESRouter()

// Inline functions allows Typescript to automatic infer types
const processEmail = defineRoute({
  filters: {
    receiptStatuses: ['PASS'],
  },
}).handle(async ({ mail, receipt }) => {
  console.log(`Email from ${mail.source}: ${mail.commonHeaders.subject}`)
})
sesRouter.route(processEmail)
```

OR use a the separate syntax to split router and handlers across files:

```ts
// ses.ts
import { createSESRouter } from '@lambda-event-router/ses'

const sesRouter = createSESRouter()

// Separate handler to define routes and handlers in different places
sesRouter.route({
  filters: { receiptStatuses: ['PASS'] },
  handler: processEmail,
})

// Types do need to be explicitly defined - they can not be inferred by Typescript
export async function processEmail({ mail, receipt }) {
  console.log(`Email from ${mail.source}: ${mail.commonHeaders.subject}`)
}
```


## Usage

#### Inline handlers

```ts
import { createSESRouter, defineRoute } from '@lambda-event-router/ses'

const sesRouter = createSESRouter()

const processEmail = defineRoute({
  filters: { receiptStatuses: ['PASS'] },
}).handle(async ({ mail, receipt }) => {
  console.log(`Email from ${mail.source}: ${mail.commonHeaders.subject}`)
})

sesRouter.route(processEmail)
```

#### Separate handlers

```ts
import { createSESRouter } from '@lambda-event-router/ses'

const sesRouter = createSESRouter()

sesRouter.route({
  filters: { receiptStatuses: ['PASS'] },
  handler: processEmail,
})

async function processEmail({ mail, receipt }) {
  console.log(`Email from ${mail.source}: ${mail.commonHeaders.subject}`)
}
```

#### Filters

```ts
defineRoute({
  filters: {
    receiptStatuses: ['PASS'],
    customFilter: ({ mail }) => mail.destination.includes('support@example.com'),
  },
})
```

## Examples

See the [examples/ses](../../examples/ses) directory for complete working examples.
