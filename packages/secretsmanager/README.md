# @latcher/secretsmanager

Routes each Secrets Manager rotation step to its own handler. Secrets Manager calls your Lambda once per step, and you register a handler for each of the four steps.

**Supported AWS Services:** `AWS Secrets Manager`

**Available Matchers:** `SecretsManagerMatcher`

**Docs:** [SecretsManagerMatcher](https://pyepye.github.io/latcher/matchers/SecretsManagerMatcher)

## Install

```bash
npm install @latcher/base @latcher/secretsmanager
```

`@latcher/base` is a peer dependency, so install it yourself. It exports `Latcher`, which every matcher plugs into.

## Quick Start

```ts
// main handler
import { Latcher } from '@latcher/base'
import { secretsManagerMatcher } from './secretsmanager'

const latcher = new Latcher({
  matchers: [secretsManagerMatcher],
})

export const handler = latcher.handler()
```

```ts
// secretsmanager.ts
import { createSecretsManagerMatcher, defineRoute } from '@latcher/secretsmanager'

export const secretsManagerMatcher = createSecretsManagerMatcher()

const createDatabaseSecret = defineRoute({
  filters: {
    step: 'createSecret',
    secretId: 'prod/database/*',
  },
}).handle(async ({ secretId, clientRequestToken }) => {
  console.log(`Creating version ${clientRequestToken} of ${secretId}`)
})

secretsManagerMatcher.route(createDatabaseSecret)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/latcher/matchers/SecretsManagerMatcher#annotated-handlers).

## Documentation

- [SecretsManagerMatcher](https://pyepye.github.io/latcher/matchers/SecretsManagerMatcher) covers every filter, failures and retries
  and middleware.
- [Handlers](https://pyepye.github.io/latcher/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/secretsmanager](../../service-examples/secretsmanager) for a deployable app.
