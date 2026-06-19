# @lambda-event-router/secretsmanager

Secrets Manager rotation step routing with typed methods for each rotation step.

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/secretsmanager
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.

## Quick Start

```ts
import { createSecretsManagerRouter, defineRoute } from '@lambda-event-router/secretsmanager'

const secretsManagerRouter = createSecretsManagerRouter()

secretsManagerRouter
  .createSecret(createSecretRoute)
  .setSecret(setSecretRoute)
  .testSecret(testSecretRoute)
  .finishSecret(finishSecretRoute)
```

## Usage

### Typed step methods

```ts
const secretsManagerRouter = createSecretsManagerRouter()

secretsManagerRouter.createSecret({
  filters: { secretId: 'prod/database/*' },
  handler: async ({ secretId, clientRequestToken, step }) => {
    console.log(`Creating secret ${secretId} - step: ${step}`)
  },
})

secretsManagerRouter.setSecret({
  filters: { secretId: 'prod/database/*' },
  handler: async ({ secretId }) => {
    console.log(`Setting secret ${secretId}`)
  },
})

secretsManagerRouter.testSecret({
  filters: { secretId: 'prod/database/*' },
  handler: async ({ secretId }) => {
    console.log(`Testing secret ${secretId}`)
  },
})

secretsManagerRouter.finishSecret({
  filters: { secretId: 'prod/database/*' },
  handler: async ({ secretId }) => {
    console.log(`Finishing rotation for ${secretId}`)
  },
})
```

### Filters

```ts
defineRoute({
  filters: {
    step: 'createSecret',
    secretId: /^prod\/database\//,
    custom: ({ secretName }) => secretName.startsWith('prod/'),
  },
})
```

`secretId` is matched against the secret ARN and against the name on its own, so either form works.
The event itself only ever carries the ARN, which is why `secretName` exists on the request and on
the filter input.

## Examples

See the [examples/secretsmanager](../../examples/secretsmanager) directory for complete working examples.
