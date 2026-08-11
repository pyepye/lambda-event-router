# @lambda-event-router/cloudformation

Routes CloudFormation custom resource requests to a handler for each request type: Create, Update or Delete.

**Supported AWS Services:** `AWS CloudFormation`

**Available Routers:** `CloudFormationRouter`

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/cloudformation
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.


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

// An inferred handler takes its types from the route
const handleCreate = defineRoute({
  filters: {
    requestType: 'Create',
  },
}).handle(async ({ requestType, resourceProperties, stackId }) => {
  console.log(`Creating custom resource in stack ${stackId}`)
})
cloudformationRouter.route(handleCreate)
```

Or use an annotated handler, which names its types rather than inferring them:

```ts
// cloudformation.ts
import { createCloudFormationRouter } from '@lambda-event-router/cloudformation'

const cloudformationRouter = createCloudFormationRouter()

cloudformationRouter.route({
  filters: { requestType: 'Create' },
  handler: handleCreate,
})

// An annotated handler names its own types
export async function handleCreate({ requestType, resourceProperties, stackId }) {
  console.log(`Creating custom resource in stack ${stackId}`)
}
```


## Usage

#### Inferred handlers

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

#### Annotated handlers

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
    custom: ({ resourceType }) => resourceType === 'Custom::MyResource',
  },
})
```
