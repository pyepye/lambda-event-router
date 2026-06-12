# @lambda-event-router/codecommit

CodeCommit repository event routing by repository, branch, and the kind of change.

**Supported AWS Services:** `AWS CodeCommit`

**Available Routers:** `CodeCommitRouter`

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/codecommit
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.

## Quick Start

```ts
import { createCodeCommitRouter, defineRoute } from '@lambda-event-router/codecommit'

const codecommitRouter = createCodeCommitRouter()

codecommitRouter.push(
  defineRoute({
    filters: {
      repositoryName: 'my-repo',
      branch: 'main',
    },
  }).handle(async ({ references, userIdentityARN }) => {
    for (const reference of references) {
      console.log(`New commit ${reference.commit} on ${reference.ref} by ${userIdentityARN}`)
    }
  })
)
```

## Usage

### Filters

`branch` matches with `refs/heads/` already stripped, and `repositoryName` matches the last segment of
the repository ARN.

```ts
defineRoute({
  filters: {
    eventSourceArn: 'arn:aws:codecommit:us-east-1:123456789012:my-repo',
    repositoryName: ['my-repo', 'other-repo'],
    branch: ['main', 'develop'],
    custom: ({ userIdentityARN }) => !userIdentityARN.includes('deploy-bot'),
  },
})
```

### Reference filters

A record carries every ref that moved. `push()`, `branchCreated()` and `branchDeleted()` narrow which of
them a route sees, and `route()` sees all of them.

```ts
codecommitRouter
  .push({ filters: { repositoryName: 'my-repo' }, handler: onPush })
  .branchCreated({ filters: { repositoryName: 'my-repo' }, handler: onBranchCreated })
  .branchDeleted({ filters: { repositoryName: 'my-repo' }, handler: onBranchDeleted })
```

Every route that matches runs, so a record can reach more than one handler with a different subset of
the references each time.

## Examples

See the [examples/codecommit](../../examples/codecommit) directory for complete working examples.
