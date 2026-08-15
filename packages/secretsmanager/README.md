# @lambda-event-router/secretsmanager

Routes each Secrets Manager rotation step to its own handler. Secrets Manager calls your Lambda once per step, and you register a handler for each of the four steps.

**Supported AWS Services:** `AWS Secrets Manager`

**Available Routers:** `SecretsManagerRouter`

**Docs:** [SecretsManagerRouter](https://pyepye.github.io/lambda-event-router/routers/SecretsManagerRouter)

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/secretsmanager
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.

## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { secretsManagerRouter } from './secretsmanager'

const lambdaRouter = new LambdaRouter({
  routers: [secretsManagerRouter],
})

export const handler = lambdaRouter.handler()
```

```ts
// secretsmanager.ts
import { createSecretsManagerRouter, defineRoute } from '@lambda-event-router/secretsmanager'

export const secretsManagerRouter = createSecretsManagerRouter()

const createDatabaseSecret = defineRoute({
  filters: {
    step: 'createSecret',
    secretId: 'prod/database/*',
  },
}).handle(async ({ secretId, clientRequestToken }) => {
  console.log(`Creating version ${clientRequestToken} of ${secretId}`)
})

secretsManagerRouter.route(createDatabaseSecret)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/lambda-event-router/routers/SecretsManagerRouter#annotated-handlers).

## Documentation

- [SecretsManagerRouter](https://pyepye.github.io/lambda-event-router/routers/SecretsManagerRouter) covers every filter, failures and retries
  and middleware.
- [Handlers](https://pyepye.github.io/lambda-event-router/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/secretsmanager](../../service-examples/secretsmanager) for a deployable app.
