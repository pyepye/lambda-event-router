# @lambda-event-router/cloudformation

CloudFormation custom resource routing for Create, Update, and Delete request types.

**Supported AWS Services:** `AWS CloudFormation`

**Available Routers:** `CloudFormationRouter`

## Install

```bash
npm install @lambda-event-router/cloudformation
```


## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { cloudformationRouter } from './cloudformation'

const lambdaRouter = new LambdaRouter({
  routers: [cloudformationRouter]
})

export const handler = lambdaRouter.handler()
```

```ts
// cloudformation.ts
import { createCloudFormationRouter, defineRoute } from '@lambda-event-router/cloudformation'

const cloudformationRouter = createCloudFormationRouter()

// Inline functions allows Typescript to automatic infer types
const handleCreate = defineRoute({
  filters: {
    requestType: 'Create',
  },
}).handle(async ({ requestType, resourceProperties, stackId }) => {
  console.log(`Creating custom resource in stack ${stackId}`)
})
cloudformationRouter.route(handleCreate)
```

OR use a the separate syntax to split router and handlers across files:

```ts
// cloudformation.ts
import { createCloudFormationRouter } from '@lambda-event-router/cloudformation'

const cloudformationRouter = createCloudFormationRouter()

// Separate handler to define routes and handlers in different places
cloudformationRouter.route({
  filters: { requestType: 'Create' },
  handler: handleCreate,
})

// Types do need to be explicitly defined - they can not be inferred by Typescript
export async function handleCreate({ requestType, resourceProperties, stackId }) {
  console.log(`Creating custom resource in stack ${stackId}`)
}
```


## Usage

#### Inline handlers

```ts
import { createCloudFormationRouter, defineRoute } from '@lambda-event-router/cloudformation'

const cloudformationRouter = createCloudFormationRouter()

const handleCreate = defineRoute({
  filters: { requestType: 'Create' },
}).handle(async ({ requestType, resourceProperties, stackId }) => {
  console.log(`Creating custom resource in stack ${stackId}`)
})

cloudformationRouter.route(handleCreate)
```

#### Separate handlers

```ts
import { createCloudFormationRouter } from '@lambda-event-router/cloudformation'

const cloudformationRouter = createCloudFormationRouter()

cloudformationRouter.route({
  filters: { requestType: 'Create' },
  handler: handleCreate,
})

async function handleCreate({ requestType, resourceProperties, stackId }) {
  console.log(`Creating custom resource in stack ${stackId}`)
}
```

#### Filters

```ts
defineRoute({
  filters: {
    requestType: ['Create', 'Update', 'Delete'],
    customFilter: ({ resourceType }) => resourceType === 'Custom::MyResource',
  },
})
```

## Examples

See the [examples/cloudformation](../../examples/cloudformation) directory for complete working examples.
