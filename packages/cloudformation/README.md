# @latcher/cloudformation

Routes CloudFormation custom resource requests to a handler for each request type: Create, Update or Delete.

**Supported AWS Services:** `AWS CloudFormation`

**Available Matchers:** `CloudFormationMatcher`

## Install

```bash
npm install @latcher/base @latcher/cloudformation
```

`@latcher/base` is a peer dependency, so install it yourself. It exports `Latcher`, which every matcher plugs into.

## Quick Start

```ts
// main handler
import { Latcher } from '@latcher/base'
import { cloudformationMatcher } from './cloudformation'

const latcher = new Latcher({
  matchers: [cloudformationMatcher]
})

export const handler = latcher.handler()
```

```ts
// cloudformation.ts
import { createCloudFormationMatcher, defineRoute } from '@latcher/cloudformation'

const cloudformationMatcher = createCloudFormationMatcher()

// An inferred handler takes its types from the route
const handleCreate = defineRoute({
  filters: {
    requestType: 'Create',
  },
}).handle(async ({ requestType, resourceProperties, stackId }) => {
  console.log(`Creating custom resource in stack ${stackId}`)
})
cloudformationMatcher.route(handleCreate)
```

Or use an annotated handler, which names its types rather than inferring them:

```ts
// cloudformation.ts
import { createCloudFormationMatcher } from '@latcher/cloudformation'

const cloudformationMatcher = createCloudFormationMatcher()

cloudformationMatcher.route({
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
import { createCloudFormationMatcher, defineRoute } from '@latcher/cloudformation'

const cloudformationMatcher = createCloudFormationMatcher()

const handleCreate = defineRoute({
  filters: { requestType: 'Create' },
}).handle(async ({ requestType, resourceProperties, stackId }) => {
  console.log(`Creating custom resource in stack ${stackId}`)
})

cloudformationMatcher.route(handleCreate)
```

#### Annotated handlers

```ts
import { createCloudFormationMatcher } from '@latcher/cloudformation'

const cloudformationMatcher = createCloudFormationMatcher()

cloudformationMatcher.route({
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
