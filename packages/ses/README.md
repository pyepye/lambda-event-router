# @lambda-event-router/ses

Routes inbound SES email to handlers by receipt status. Your handler gets the sender, subject and recipients already taken out of the event.

**Supported AWS Services:** `Amazon SES`

**Available Routers:** `SESRouter`

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/ses
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.


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

// An inferred handler takes its types from the route
const processEmail = defineRoute({
  filters: {
    spamVerdict: 'PASS',
  },
}).handle(async ({ mail, receipt }) => {
  console.log(`Email from ${mail.source}: ${mail.commonHeaders.subject}`)
})
sesRouter.route(processEmail)
```

Or use an annotated handler, which names its types rather than inferring them:

```ts
// ses.ts
import { createSESRouter } from '@lambda-event-router/ses'
import type { SESRequest } from '@lambda-event-router/ses'

const sesRouter = createSESRouter()

sesRouter.route({
  filters: { spamVerdict: 'PASS' },
  handler: processEmail,
})

// An annotated handler names its own types
export async function processEmail({ mail, receipt }: SESRequest) {
  console.log(`Email from ${mail.source}: ${mail.commonHeaders.subject}`)
}
```


## Usage

#### Inferred handlers

```ts
import { createSESRouter, defineRoute } from '@lambda-event-router/ses'

const sesRouter = createSESRouter()

const processEmail = defineRoute({
  filters: { spamVerdict: 'PASS' },
}).handle(async ({ mail, receipt }) => {
  console.log(`Email from ${mail.source}: ${mail.commonHeaders.subject}`)
})

sesRouter.route(processEmail)
```

#### Annotated handlers

```ts
import { createSESRouter } from '@lambda-event-router/ses'
import type { SESRequest } from '@lambda-event-router/ses'

const sesRouter = createSESRouter()

sesRouter.route({
  filters: { spamVerdict: 'PASS' },
  handler: processEmail,
})

async function processEmail({ mail, receipt }: SESRequest) {
  console.log(`Email from ${mail.source}: ${mail.commonHeaders.subject}`)
}
```

#### Filters

```ts
defineRoute({
  filters: {
    spamVerdict: 'PASS',
    custom: ({ mail }) => mail.destination.includes('support@example.com'),
  },
})
```

#### Dispositions

Return a disposition to control what SES does after your Lambda. Return nothing and mail flow carries
on, the same as `CONTINUE`.

```ts
defineRoute({
  filters: { spamVerdict: 'FAIL' },
}).handle(async ({ mail }) => {
  console.log(`Blocking ${mail.source}`)
  return 'STOP_RULE_SET' // Stop the rest of the receipt rule set
})
```

`STOP_RULE` skips the rest of the current rule, `STOP_RULE_SET` skips every remaining rule. This only
takes effect when the receipt rule invokes your Lambda synchronously (`RequestResponse`).
