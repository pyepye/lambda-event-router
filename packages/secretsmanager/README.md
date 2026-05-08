# @lambda-event-router/secretsmanager

Secrets Manager rotation step routing with typed methods for each rotation step.

## Install

```bash
npm install @lambda-event-router/secretsmanager
```

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
  handler: async ({ secretId, clientRequestToken, step }) => {
    console.log(`Creating secret ${secretId} - step: ${step}`)
  },
})

secretsManagerRouter.setSecret({
  handler: async ({ secretId }) => {
    console.log(`Setting secret ${secretId}`)
  },
})

secretsManagerRouter.testSecret({
  handler: async ({ secretId }) => {
    console.log(`Testing secret ${secretId}`)
  },
})

secretsManagerRouter.finishSecret({
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
    customFilter: ({ secretId }) => secretId.startsWith('prod/'),
  },
})
```

## Examples

See the [examples/secretsmanager](../../examples/secretsmanager) directory for complete working examples.
