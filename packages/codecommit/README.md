# @lambda-event-router/codecommit

Routes CodeCommit repository triggers to handlers by repository, branch and kind of change. Every matching route runs. Routes added with `push()`, `branchCreated()` or `branchDeleted()` get only that kind of reference.

**Supported AWS Services:** `AWS CodeCommit`

**Available Routers:** `CodeCommitRouter`

**Docs:** [CodeCommitRouter](https://pyepye.github.io/lambda-event-router/routers/CodeCommitRouter)

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/codecommit
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.

## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { codeCommitRouter } from './codecommit'

const lambdaRouter = new LambdaRouter({
  routers: [codeCommitRouter],
})

export const handler = lambdaRouter.handler()
```

```ts
// codecommit.ts
import { createCodeCommitRouter, defineRoute } from '@lambda-event-router/codecommit'

export const codeCommitRouter = createCodeCommitRouter()

const onMainPush = defineRoute({
  filters: {
    eventSourceArn: 'arn:aws:codecommit:eu-west-2:123456789012:checkout-service',
    repositoryName: 'checkout-service',
    branch: 'main',
  },
}).handle(async ({ references, userIdentityARN }) => {
  console.log(`${userIdentityARN} pushed ${references.map((reference) => reference.commit).join(', ')}`)
})

codeCommitRouter.push(onMainPush)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/lambda-event-router/routers/CodeCommitRouter#annotated-handlers).

## Documentation

- [CodeCommitRouter](https://pyepye.github.io/lambda-event-router/routers/CodeCommitRouter) covers every filter, failures and middleware.
- [Handlers](https://pyepye.github.io/lambda-event-router/docs/handlers) covers inferred and annotated handlers.
