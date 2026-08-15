# @lambda-event-router/ses

Routes inbound SES email to handlers by receipt status. Your handler gets the sender, subject and recipients already taken out of the event.

**Supported AWS Services:** `Amazon SES`

**Available Routers:** `SESRouter`

**Docs:** [SESRouter](https://pyepye.github.io/lambda-event-router/routers/SESRouter)

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
  routers: [sesRouter],
})

export const handler = lambdaRouter.handler()
```

```ts
// ses.ts
import { createSESRouter, defineRoute } from '@lambda-event-router/ses'

export const sesRouter = createSESRouter()

const supportEmail = defineRoute({
  filters: {
    recipient: 'support@example.com',
    sender: '*@partner.com',
    spamVerdict: 'PASS',
    virusVerdict: 'PASS',
    spfVerdict: 'PASS',
    dkimVerdict: 'PASS',
    dmarcVerdict: 'PASS',
  },
}).handle(async ({ source, subject }) => {
  console.log(`Support email from ${source}: ${subject ?? 'no subject'}`)
})

sesRouter.route(supportEmail)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/lambda-event-router/routers/SESRouter#annotated-handlers).

## Documentation

- [SESRouter](https://pyepye.github.io/lambda-event-router/routers/SESRouter) covers every filter, verdicts,
  dispositions and failures.
- [Handlers](https://pyepye.github.io/lambda-event-router/docs/handlers) covers inferred and annotated handlers.
