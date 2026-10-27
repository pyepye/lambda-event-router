# @latcher/codecommit

Routes CodeCommit repository triggers to handlers by repository, branch and kind of change. Every matching route runs. Routes added with `push()`, `branchCreated()` or `branchDeleted()` get only that kind of reference.

**Supported AWS Services:** `AWS CodeCommit`

**Available Matchers:** `CodeCommitMatcher`

**Docs:** [CodeCommitMatcher](https://pyepye.github.io/latcher/matchers/CodeCommitMatcher)

## Install

```bash
npm install @latcher/base @latcher/codecommit
```

`@latcher/base` is a peer dependency, so install it yourself. It exports `Latcher`, which every matcher plugs into.

## Quick Start

```ts
// main handler
import { Latcher } from '@latcher/base'
import { codeCommitMatcher } from './codecommit'

const latcher = new Latcher({
  matchers: [codeCommitMatcher],
})

export const handler = latcher.handler()
```

```ts
// codecommit.ts
import { createCodeCommitMatcher, defineRoute } from '@latcher/codecommit'

export const codeCommitMatcher = createCodeCommitMatcher()

const onMainPush = defineRoute({
  filters: {
    eventSourceArn: 'arn:aws:codecommit:eu-west-2:123456789012:checkout-service',
    repositoryName: 'checkout-service',
    branch: 'main',
  },
}).handle(async ({ references, userIdentityARN }) => {
  console.log(`${userIdentityARN} pushed ${references.map((reference) => reference.commit).join(', ')}`)
})

codeCommitMatcher.push(onMainPush)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/latcher/matchers/CodeCommitMatcher#annotated-handlers).

## Documentation

- [CodeCommitMatcher](https://pyepye.github.io/latcher/matchers/CodeCommitMatcher) covers every filter, failures and middleware.
- [Handlers](https://pyepye.github.io/latcher/docs/handlers) covers inferred and annotated handlers.
