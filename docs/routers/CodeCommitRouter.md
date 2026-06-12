# CodeCommitRouter

`CodeCommitRouter` routes AWS CodeCommit repository triggers to handlers, one record at a time.

A trigger fires when refs on a repository move, and a record carries every ref that moved: commits
pushed to a branch, branches created, branches deleted. The router works out which of your routes
should handle each record and hands your handler the references that route asked for.

**Every route that matches runs, rather than only the first.** A single push can create one branch and
add commits to another, so the record goes to each matching route with its own subset of the references
instead of the router picking one winner.

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/codecommit
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports
`LambdaRouter`, which every router plugs into.

## Create the router

```ts
import { createCodeCommitRouter } from '@lambda-event-router/codecommit'
import { logInvocation } from './middleware/logInvocation'

const codeCommitRouter = createCodeCommitRouter({
  middleware: [logInvocation],  // Optional
})
```

The one option can be left out, so `createCodeCommitRouter()` is what you want most of the time.

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `middleware` | `CodeCommitMiddleware[]` | No | `[]` | Runs for every route this router matches, before any route middleware. See [Middleware](#middleware) |

## Register routes

```ts
codeCommitRouter.route({
  filters: {
    repositoryName: 'checkout-service',
    branch: 'main',
  },
  middleware: [withRepoContext],  // Optional
  handler: onMainPush,
})
```

`filters` and `handler` are the only required keys.

`route()` returns the router, so you can chain registrations.

```ts
codeCommitRouter.route(mainPushRoute).route(releasePushRoute)
```

Routes do not compete. Each is tested against the record on its own and every one that matches runs, so
two routes both asking for pushes to `main` both get them. Registration order changes nothing, which
means overlapping filters are a design choice here rather than a bug to avoid. See [match
order](/docs/routing#match-order) for the first match behaviour to expect elsewhere.

**A record matching no route at all throws.** A route with empty `filters` matches every record and
gives unrouted triggers somewhere to go, and see [nothing matched](/docs/routing#nothing-matched) for
what the other routers do instead.

### Convenience methods

`push()`, `branchCreated()` and `branchDeleted()` narrow which references a route sees. Each takes
exactly what `route()` takes.

```ts
// Only the references that are commits to a branch which already existed
codeCommitRouter.push({
  filters: { repositoryName: 'checkout-service' },
  handler: onPush,
})
```

| Method | References the handler is given |
| --- | --- |
| `push()` | Those with neither `created` nor `deleted` set, so commits to a branch that already existed |
| `branchCreated()` | Those with `created: true` |
| `branchDeleted()` | Those with `deleted: true` |
| `route()` | All of them, whatever moved |

The reference filter runs before any of the filter keys, and a route left with no references does not
match at all, so `branchCreated()` sits out a record that only carried commits.

**`route()` sees branch deletions as well as pushes.** It passes every reference through, so a route
filtering only on `repositoryName` fires when someone deletes a branch just as it does when they push
to one. Reach for `push()` when you mean commits.

None of the three can be written as a `route()` call, since the reference filter is not one of the
filter keys. See [convenience methods](/docs/routing#convenience-methods) for how the other routers use
them.

## Filters

Every filter key on one route, showing each form a value can take. All of them are optional, so set the
ones that pick out the records you want and leave the rest off.

```ts
codeCommitRouter.route({
  filters: {
    eventSourceArn: CHECKOUT_REPO_ARN,
    repositoryName: ['checkout-service', 'payment-service'],
    branch: 'release/*', // Or a pattern: /^release\//
    custom: ({ userIdentityARN }) => {
      // Only a custom reaches the identity that pushed
      return !userIdentityARN.includes('deploy-bot')
    },
  },
  handler: onReleasePush,
})
```

| Filter | Type | Description |
| --- | --- | --- |
| `eventSourceArn` | `FilterStringMatcher` | Matches the repository ARN on the record |
| `repositoryName` | `FilterStringMatcher` | Matches the last segment of that ARN, which is the repository name |
| `branch` | `FilterStringMatcher` | Matches against the branch name with `refs/heads/` already stripped, so `'main'` rather than `'refs/heads/main'`. Matches when any one reference does |
| `custom` | `(input: CodeCommitFilterInput) => boolean \| Promise<boolean>` | Anything the other filters cannot express, given the references, the pushing identity, the repository ARN and the trigger name. Can be async |

`FilterStringMatcher` is `string | RegExp | Array<string | RegExp>`. See
[filters](/docs/routing#filters) for how each form matches, including the `*` wildcard.

The wildcard is what makes branch prefixes workable, so `'release/*'` takes every release branch and
`'feature/*'` every feature branch.

**`branch` decides whether the route matches, it does not narrow the references.** A push touching both
`main` and `develop` arrives as one record, so a route filtering on `main` matches and the handler is
given both references. Read `ref` on each reference when the others matter.

`custom` is given the references a reference filter has already narrowed, along with the identity
that pushed, so it is where a check on the IAM role belongs. Its input carries no record and no
context, and [`custom`](/docs/routing#custom) covers where it sits in the filter order.

## Handler

Handlers take one argument and return nothing.

```ts
import { logger } from '@lambda-event-router/base'
import type { CodeCommitRequest, CodeCommitResponse } from '@lambda-event-router/codecommit'

export async function onMainPush(request: CodeCommitRequest): Promise<CodeCommitResponse> {
  for (const reference of request.references) {
    logger.info(`${reference.ref} moved to ${reference.commit} by ${request.userIdentityARN}`)
  }
}
```

### Request object

| Field | Type | Description |
| --- | --- | --- |
| `references` | `CodeCommitReference[]` | The references this route matched, narrowed by its reference filter. See [References](#references) |
| `userIdentityARN` | `string` | The IAM identity that made the change |
| `eventTriggerName` | `string` | The name of the trigger on the repository that fired |
| `eventSourceARN` | `string` | The repository ARN |
| `record` | `CodeCommitRecord` | The untouched record from AWS, for `eventTime`, `customData` and the full reference list |
| `context` | `Context` | The Lambda context |

**Only `Context` comes from `aws-lambda` here.** `@types/aws-lambda` carries no CodeCommit types, so
`CodeCommitRecord`, `CodeCommitReference` and `CodeCommitEvent` are all defined by this package and
imported from it.

`record.codecommit.references` is the full list the trigger sent, which is worth reading when a route
with a reference filter needs to know what else moved in the same push.

### References

A reference is one ref that moved.

| Field | Type | Description |
| --- | --- | --- |
| `commit` | `string` | The commit id for the ref |
| `ref` | `string` | The full ref, so `refs/heads/main` |
| `created` | `boolean \| undefined` | Set when the ref is new |
| `deleted` | `boolean \| undefined` | Set when the ref has gone |

Both flags are absent on a plain push, which is what `push()` keys off.

### Response type

`CodeCommitResponse` is `undefined`. There is nothing useful to return to a repository trigger, so
handlers return `Promise<CodeCommitResponse>` and the router hands nothing back to Lambda.

Throwing is how you signal failure. See [Failures](#failures) for what that does to the other routes
that matched.

### Inferred handlers

No schemas on this router, so there is no payload shape for `defineRoute` to work out. What it gives
you is the request already typed, so the handler destructures `references` without you naming
`CodeCommitRequest` anywhere.

```ts
import { logger } from '@lambda-event-router/base'
import { defineRoute } from '@lambda-event-router/codecommit'

export const mainPushRoute = defineRoute({
  filters: {
    repositoryName: 'checkout-service',
    branch: 'main',
  },
}).handle(async ({ references, userIdentityARN }) => {
  for (const reference of references) {
    logger.info(`Push to main at ${reference.commit} by ${userIdentityARN}`)
  }
})

codeCommitRouter.push(mainPushRoute)
```

A route built with `defineRoute` can go to `route()` or to any of the convenience methods, since they
all take the same definition.

Inference pays off most in a Lambda taking several event sources, since you never have to know any of
their request shapes. See [inferred handlers](/docs/handlers#inferred-handlers), where the same queue
is written both ways to compare.

### Annotated handlers

Annotating the request yourself splits route setup from business logic, using
[`CodeCommitRequest`](#request-object) in the handler's own file.

```ts
// handlers/onMainPush.ts
import { logger } from '@lambda-event-router/base'
import type { CodeCommitRequest, CodeCommitResponse } from '@lambda-event-router/codecommit'

export async function onMainPush(request: CodeCommitRequest): Promise<CodeCommitResponse> {
  const { references, userIdentityARN } = request
  logger.info(`${references.length} commits to main by ${userIdentityARN}`)
}
```

```ts
// codecommit.ts
import { createCodeCommitRouter } from '@lambda-event-router/codecommit'
import { onMainPush } from './handlers/onMainPush'

const codeCommitRouter = createCodeCommitRouter()

codeCommitRouter.push({
  filters: { repositoryName: 'checkout-service', branch: 'main' },
  handler: onMainPush,
})
```

`CodeCommitRequest` takes no type parameters, so there is nothing to pass and both forms hand your
handler exactly the same object. See [annotated handlers](/docs/handlers#annotated-handlers) for the
worked version.

## Failures

A handler that throws fails the invocation. Records run in parallel, and the handlers for every route
matching one record run in parallel too, so a throw surfaces once the others have settled rather than
stopping them.

**One route failing tells you nothing about the rest.** The other matched handlers still run to
completion and nothing in the result says which of them got through, so make each one safe to run twice
if the trigger can be retried.

A record matching no route throws the same way, naming the `eventId` it could not place.

## Middleware

Router and route middleware are both typed `CodeCommitMiddleware`, and the chain runs once per matched
route rather than once per record. A record matching three routes runs the router middleware three
times, each with that route's own references.

```ts
import { logger } from '@lambda-event-router/base'
import type { CodeCommitMiddleware } from '@lambda-event-router/codecommit'

export const logInvocation: CodeCommitMiddleware = async (request, next) => {
  logger.info(`${request.eventTriggerName} matched ${request.references.length} references`)
  return next(request)
}
```

```ts
const codeCommitRouter = createCodeCommitRouter({ middleware: [logInvocation] })

codeCommitRouter.push({
  filters: { repositoryName: 'checkout-service' },
  middleware: [withRepoContext],
  handler: onPush,
})
```

Matched routes run in parallel, so pass per-route values on each log call rather than reaching for
`appendKeys`. See [middleware](/docs/middleware) for the execution order and the three levels it
attaches at.

## Types

All exported from `@lambda-event-router/codecommit`.

| Type | Description |
| --- | --- |
| `CodeCommitRequest` | The handler argument |
| `CodeCommitResponse` | Handler return type, `undefined` |
| `CodeCommitReference` | One ref that moved. See [References](#references) |
| `CodeCommitRecord` | One record from the trigger event |
| `CodeCommitEvent` | The whole event, as `{ Records }` |
| `CodeCommitFilters` | The `filters` object |
| `CodeCommitFilterInput` | What `custom` receives |
| `CodeCommitRecordHandler` | A handler, `(request: CodeCommitRequest) => Promise<void>` |
| `CodeCommitRouteDefinition` | A full route passed to `route()` or any convenience method |
| `CodeCommitRouterOptions` | Options for `createCodeCommitRouter` |
| `CodeCommitMiddleware` | Router and route middleware |

None of them take a type parameter, since there is no schema here for a shape to be inferred from.

The `CodeCommitRouter` class and the `createCodeCommitRouter` and `defineRoute` functions come from the
same place.

## Code example

One repository with a route per kind of change, plus an audit route that takes everything.

Open a file: [index.ts](#codecommit-example:index.ts) | [CodeCommit router](#codecommit-example:codecommit.ts) | [handlers](#codecommit-example:handlers/repository.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { codeCommitRouter } from './codecommit.js'

const lambdaRouter = new LambdaRouter({
  routers: [codeCommitRouter],
})

export const handler: Handler = lambdaRouter.handler()`,
  },
  {
    path: 'codecommit.ts',
    code: `import { createCodeCommitRouter } from '@lambda-event-router/codecommit'

import { onAnyChange, onBranchDeleted, onMainPush, onReleasePush } from './handlers/repository.js'

const CHECKOUT_REPO_ARN = 'arn:aws:codecommit:eu-west-2:123456789012:checkout-service'

export const codeCommitRouter = createCodeCommitRouter()

codeCommitRouter
  .push({
    filters: { eventSourceArn: CHECKOUT_REPO_ARN, branch: 'main' },
    handler: onMainPush,
  })
  .push({
    filters: { eventSourceArn: CHECKOUT_REPO_ARN, branch: 'release/*' },
    handler: onReleasePush,
  })
  .branchDeleted({
    filters: { eventSourceArn: CHECKOUT_REPO_ARN },
    handler: onBranchDeleted,
  })
  .route({
    filters: { eventSourceArn: CHECKOUT_REPO_ARN },
    handler: onAnyChange,
  })`,
  },
  {
    path: 'handlers/repository.ts',
    code: `import { logger } from '@lambda-event-router/base'
import type { CodeCommitRequest, CodeCommitResponse } from '@lambda-event-router/codecommit'

export async function onMainPush(request: CodeCommitRequest): Promise<CodeCommitResponse> {
  for (const reference of request.references) {
    logger.info(\`Deploying \${reference.commit} from \${reference.ref}\`)
  }
}

export async function onReleasePush(request: CodeCommitRequest): Promise<CodeCommitResponse> {
  for (const reference of request.references) {
    logger.info(\`Release branch \${reference.ref} moved to \${reference.commit}\`)
  }
}

export async function onBranchDeleted(request: CodeCommitRequest): Promise<CodeCommitResponse> {
  const branches = request.references.map((reference) => reference.ref).join(', ')

  logger.info(\`\${request.userIdentityARN} deleted \${branches}\`)
}

export async function onAnyChange(request: CodeCommitRequest): Promise<CodeCommitResponse> {
  const { references, userIdentityARN, eventTriggerName } = request

  logger.info(\`\${eventTriggerName}: \${references.length} refs moved by \${userIdentityARN}\`)
}`,
  },
]
</script>

<CodeFileViewer :files="files" id="codecommit-example" default-file="codecommit.ts" line-numbers collapse-toggle fixed-height />

`onAnyChange` runs on top of whichever other routes matched, so a push to `main` reaches both
`onMainPush` and the audit route. That is the multi-match behaviour doing real work rather than
something to design around.

It also covers the gap the other three leave. A branch creation matches none of them, and without the
audit route that record would throw.

The two `push()` routes both filter on a branch, and `branch` only decides whether the route matches. A
push touching `main` and a release branch together gives each handler every reference in the record, so
both read `ref` rather than assuming.

`index.ts` hands the router to `LambdaRouter`, which is what AWS invokes and what every router in the
Lambda gets registered on. See [routers](/docs/routers) for how the two levels of matching fit
together.
