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
      repository: 'my-repo',
      branch: 'main',
      event: 'referenceCreated',
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
    repository: ['my-repo', 'other-repo'],
    branch: ['main', 'develop'],
    event: ['referenceCreated', 'referenceUpdated'],
    customFilter: ({ record }) => record.codecommit.references.length > 0,
  },
})
```

## Examples

See the [examples/codecommit](../../examples/codecommit) directory for complete working examples.
