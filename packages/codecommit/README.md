# @lambda-event-router/codecommit

CodeCommit repository event routing by repository, branch, and event type.

## Install

```bash
npm install @lambda-event-router/codecommit
```

## Quick Start

```ts
import { createCodeCommitRouter, defineRoute } from '@lambda-event-router/codecommit'

const codecommitRouter = createCodeCommitRouter()

codecommitRouter.route(
  defineRoute({
    filters: {
      repositories: ['my-repo'],
      branches: ['main'],
      events: ['referenceCreated'],
    },
  }).handle(async ({ repository, branch }) => {
    console.log(`New commit on ${repository}/${branch}`)
  })
)
```

## Usage

### Filters

```ts
defineRoute({
  filters: {
    repositories: ['my-repo', 'other-repo'],
    branches: ['main', 'develop'],
    events: ['referenceCreated', 'referenceUpdated'],
    customFilter: ({ record }) => record.codecommit.references.length > 0,
  },
})
```

## Examples

See the [examples/codecommit](../../examples/codecommit) directory for complete working examples.
