# SESRouter

`SESRouter` routes inbound Amazon SES email to handlers, one message at a time.

SES invokes your Lambda as an action on a receipt rule and hands it the message's headers along with
the verdicts from its spam, virus and authentication checks. The router works out which of your routes
should handle each message and gives your handler the sender, subject and recipients already pulled
out.

**The event carries no email body.** Put an S3 action ahead of the Lambda action in the receipt rule
and the raw MIME message lands in your bucket under the message id, which reaches your handler as
`mail.messageId`.

## Install

```bash
npm install @lambda-event-router/ses
```

`@lambda-event-router/base` comes along as a dependency, so you do not need to install it yourself.

## Create the router

```ts
import { createSESRouter } from '@lambda-event-router/ses'
import { logInvocation } from './middleware/logInvocation'

const sesRouter = createSESRouter({
  middleware: [logInvocation],  // Optional
})
```

The one option can be left out, so `createSESRouter()` is what you want most of the time.

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `middleware` | `SESMiddleware[]` | No | `[]` | Runs for every message this router handles, before any route middleware. See [Middleware](#middleware) |

## Register routes

```ts
sesRouter.route({
  filters: {
    recipient: 'support@example.com',
    spamVerdict: 'PASS',
  },
  middleware: [withMessageContext],  // Optional
  handler: onSupportEmail,
})
```

`filters` and `handler` are the only required keys.

`route()` returns the router, so you can chain registrations.

```ts
sesRouter.route(supportEmailRoute).route(bounceRoute)
```

Routes match in registration order and the first match wins, so give each route filters no other route
can match. See [match order](/docs/routing#match-order) for what goes wrong when they overlap.

**A message that matches no route throws**, which fails the invocation. A route with empty `filters`
matches everything and gives unmatched mail somewhere to go, and see [nothing
matched](/docs/routing#nothing-matched) for what the other routers do instead.

## Filters

Every filter key on one route, showing each form a value can take. All of them are optional, so set the
ones that pick out the messages you want and leave the rest off.

```ts
sesRouter.route({
  filters: {
    recipient: ['support@example.com', 'help@*'],
    sender: '*@partner.com', // Or a pattern: /@partner\.(com|net)$/
    spamVerdict: 'PASS',
    virusVerdict: 'PASS',
    spfVerdict: ['PASS', 'GRAY'],
    dkimVerdict: 'PASS',
    dmarcVerdict: 'PASS',
    custom: ({ mail }) => {
      // Only a custom reaches the raw headers
      return mail.headers.some((header) => header.name === 'X-Newsletter-Id')
    },
  },
  handler: onSupportEmail,
})
```

| Filter | Type | Description |
| --- | --- | --- |
| `recipient` | `FilterStringMatcher` | Matches any one of the message's recipients, from `receipt.recipients` |
| `sender` | `FilterStringMatcher` | Matches the envelope sender, `mail.source` |
| `spamVerdict` | `SESReceiptStatusValue \| SESReceiptStatusValue[]` | The spam check result |
| `virusVerdict` | `SESReceiptStatusValue \| SESReceiptStatusValue[]` | The virus scan result |
| `spfVerdict` | `SESReceiptStatusValue \| SESReceiptStatusValue[]` | The SPF check result |
| `dkimVerdict` | `SESReceiptStatusValue \| SESReceiptStatusValue[]` | The DKIM check result |
| `dmarcVerdict` | `SESReceiptStatusValue \| SESReceiptStatusValue[]` | The DMARC check result |
| `custom` | `(input: SESFilterInput) => boolean \| Promise<boolean>` | Anything the other filters cannot express, given the `receipt` and `mail`. Can be async |

`FilterStringMatcher` is `string | RegExp | Array<string | RegExp>`. See
[filters](/docs/routing#filters) for how each form matches, including the `*` wildcard.

The wildcard is what makes address matching workable, so `'*@example.com'` takes a whole domain and
`'support@*'` takes one mailbox across every domain you receive for.

**A message addressed to several recipients matches on any one of them.** `recipient` tests each
address in `receipt.recipients` and stops at the first that matches, so mail to both `support@` and
`billing@` matches a route filtering on either.

`custom` reaches the raw headers and the receipt's action, which no other key does. It is given
nothing but the `receipt` and the `mail`, so there is no record or context to read there, and
[`custom`](/docs/routing#custom) covers where it sits in the filter order.

### Verdicts

The five verdict filters each compare against a status on the receipt, and they all take the same
values.

| Status | Meaning |
| --- | --- |
| `PASS` | The check passed |
| `FAIL` | The check failed |
| `GRAY` | The check ran without reaching a verdict |
| `PROCESSING_FAILED` | SES could not complete the check |
| `DISABLED` | The check is not enabled for the receipt rule |

**Ask for `PASS` rather than assuming an unfiltered route only gets clean mail.** Leave the verdicts
off and a route takes spam and infected attachments along with everything else, so put
`spamVerdict: 'PASS'` and `virusVerdict: 'PASS'` on the routes doing real work and give the rest their
own route.

## Handler

Handlers take one argument and either return nothing or return a disposition that tells SES how to
carry on with the receipt rule.

```ts
import { logger } from '@lambda-event-router/base'
import type { SESRequest, SESResponse } from '@lambda-event-router/ses'

export async function onSupportEmail(request: SESRequest): Promise<SESResponse> {
  const { source, subject, recipients } = request
  logger.info(`Email from ${source} to ${recipients.join(', ')}: ${subject ?? 'no subject'}`)
}
```

### Request object

| Field | Type | Description |
| --- | --- | --- |
| `source` | `string` | The envelope sender, the same value as `mail.source` |
| `subject` | `string \| undefined` | The `Subject` header |
| `recipients` | `string[]` | The recipients this receipt rule matched |
| `receipt` | `SESReceipt` | The full receipt: every verdict, `dmarcPolicy`, `processingTimeMillis` and the `action` that invoked you |
| `mail` | `SESMail` | The message metadata: `messageId`, `headers`, `commonHeaders` and `destination` |
| `record` | `SESEventRecord` | The untouched record from AWS |
| `context` | `Context` | The Lambda context |

`SESReceipt`, `SESMail`, `SESEventRecord` and `Context` come from `aws-lambda`, not from this package.

**`subject` is `string | undefined`.** A message sent without a `Subject` header gives you nothing
there, and it is the field most handlers reach for first.

### Response type

A handler returns a disposition to control what SES does after the Lambda action, or returns nothing
to let the rule carry on.

| Disposition | What SES does next |
| --- | --- |
| `STOP_RULE` | Skip the remaining actions in this receipt rule, then move on to the next rule |
| `STOP_RULE_SET` | Skip every remaining action and rule in the set |
| `CONTINUE` | Carry on with the remaining actions and rules. Same as returning nothing |

```ts
import type { SESRequest, SESResponse } from '@lambda-event-router/ses'

export async function onSuspectEmail(request: SESRequest): Promise<SESResponse> {
  if (request.receipt.spamVerdict.status === 'FAIL') {
    return 'STOP_RULE_SET'  // Nothing downstream should touch a message that failed its checks
  }
}
```

`SESResponse` is `SESDisposition | SESResult | void`, so a handler can return the bare disposition
string, the `{ disposition }` object SES itself reads or nothing at all. The router resolves the
disposition and hands `{ disposition }` back to Lambda.

**A disposition only takes effect on a synchronously invoked Lambda.** SES reads the return value
under the `RequestResponse` invocation type. Under `Event` invocation it fires the Lambda and ignores
what comes back, so `receipt.action` carries the `invocationType` the rule used. See [AWS's Lambda
action](https://docs.aws.amazon.com/ses/latest/dg/receiving-email-action-lambda.html) for the contract.

SES invokes with a single message, so most of the time one handler runs and its disposition is the
answer. If you ever hand `handleEvent` several records the strongest disposition any handler returns
wins, `STOP_RULE_SET` over `STOP_RULE` over `CONTINUE`.

Throwing is how you signal failure. See [Failures](#failures) for what that does to the invocation.

### Inferred handlers

No schemas on this router, so there is no body shape for `defineRoute` to work out. What it gives you
is the request already typed, so the handler destructures `source` and `subject` without you naming
`SESRequest` anywhere.

```ts
import { logger } from '@lambda-event-router/base'
import { defineRoute } from '@lambda-event-router/ses'

export const supportEmailRoute = defineRoute({
  filters: {
    recipient: 'support@example.com',
    spamVerdict: 'PASS',
    virusVerdict: 'PASS',
  },
}).handle(async ({ source, subject, recipients }) => {
  logger.info(`Support email from ${source} to ${recipients.join(', ')}: ${subject ?? 'no subject'}`)
})

sesRouter.route(supportEmailRoute)
```

Inference pays off most in a Lambda taking several event sources, since you never have to know any of
their request shapes. See [inferred handlers](/docs/handlers#inferred-handlers), where the same queue
is written both ways to compare.

### Annotated handlers

Annotating the request yourself splits route setup from business logic, using
[`SESRequest`](#request-object) in the handler's own file.

```ts
// handlers/onSupportEmail.ts
import { logger } from '@lambda-event-router/base'
import type { SESRequest, SESResponse } from '@lambda-event-router/ses'

export async function onSupportEmail(request: SESRequest): Promise<SESResponse> {
  const { source, subject } = request
  logger.info(`Support email from ${source}: ${subject ?? 'no subject'}`)
}
```

```ts
// ses.ts
import { createSESRouter } from '@lambda-event-router/ses'
import { onSupportEmail } from './handlers/onSupportEmail'

const sesRouter = createSESRouter()

sesRouter.route({
  filters: { recipient: 'support@example.com', spamVerdict: 'PASS' },
  handler: onSupportEmail,
})
```

`SESRequest` takes no type parameters, so there is nothing to pass and both forms hand your handler
exactly the same object. See [annotated handlers](/docs/handlers#annotated-handlers) for the worked
version.

## Failures

A handler that throws fails the invocation. Messages in an event are handled in parallel and the router
waits for all of them, so a throw surfaces once the others have finished rather than stopping them.

A message matching no route throws the same way, naming the message id it could not place.

What SES does after a failed invocation is set by the receipt rule rather than by the router.
`receipt.action` carries the `invocationType` the rule used, which is what decides whether SES is
waiting on your answer at all.

## Middleware

Router and route middleware are both typed `SESMiddleware`, and the chain runs once per message.

```ts
import { logger } from '@lambda-event-router/base'
import type { SESMiddleware } from '@lambda-event-router/ses'

export const logInvocation: SESMiddleware = async (request, next) => {
  logger.info(`Handling message ${request.mail.messageId} from ${request.source}`)
  return next(request)
}
```

```ts
const sesRouter = createSESRouter({ middleware: [logInvocation] })

sesRouter.route({
  filters: { recipient: 'support@example.com' },
  middleware: [withMessageContext],
  handler: onSupportEmail,
})
```

Messages in an event run in parallel, so pass per-message values on each log call rather than reaching
for `appendKeys`. See [middleware](/docs/middleware) for the execution order and the three levels it
attaches at.

## Types

All exported from `@lambda-event-router/ses`.

| Type | Description |
| --- | --- |
| `SESRequest` | The handler argument |
| `SESResponse` | Handler return type, `SESDisposition \| SESResult \| void` |
| `SESResult` | What the router hands Lambda, `{ disposition: SESDisposition }` |
| `SESDisposition` | One disposition, `'STOP_RULE' \| 'STOP_RULE_SET' \| 'CONTINUE'`. See [Response type](#response-type) |
| `SESFilters` | The `filters` object |
| `SESFilterInput` | What `custom` receives |
| `SESReceiptStatusValue` | One verdict status, `'PASS'` through `'DISABLED'`. See [Verdicts](#verdicts) |
| `SESRecordHandler` | The `handler` function, `(request: SESRequest) => Promise<SESResponse>` |
| `SESRouteDefinition` | A full route passed to `route()` |
| `SESRouterOptions` | Options for `createSESRouter` |
| `SESMiddleware` | Router and route middleware |

None of them take a type parameter, since there is no schema here for a shape to be inferred from.

The `SESRouter` class and the `createSESRouter` and `defineRoute` functions come from the same place.

## Code example

Inbound mail for a support address and a bounces address, with anything that fails its checks held back
for review.

Open a file: [index.ts](#ses-example:index.ts) | [SES router](#ses-example:ses.ts) | [handlers](#ses-example:handlers/email.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { sesRouter } from './ses.js'

const lambdaRouter = new LambdaRouter({
  routers: [sesRouter],
})

export const handler: Handler = lambdaRouter.handler()`,
  },
  {
    path: 'ses.ts',
    code: `import { createSESRouter } from '@lambda-event-router/ses'

import { onBounce, onSupportEmail, onSuspectEmail } from './handlers/email.js'

export const sesRouter = createSESRouter()

sesRouter
  .route({
    filters: {
      recipient: 'support@example.com',
      spamVerdict: 'PASS',
      virusVerdict: 'PASS',
    },
    handler: onSupportEmail,
  })
  .route({
    filters: {
      recipient: 'bounces@example.com',
      spamVerdict: 'PASS',
      virusVerdict: 'PASS',
    },
    handler: onBounce,
  })
  .route({
    filters: {},
    handler: onSuspectEmail,
  })`,
  },
  {
    path: 'handlers/email.ts',
    code: `import { logger } from '@lambda-event-router/base'
import type { SESRequest, SESResponse } from '@lambda-event-router/ses'

export async function onSupportEmail(request: SESRequest): Promise<SESResponse> {
  const { source, subject, mail } = request

  logger.info(\`Support email from \${source} (\${subject ?? 'no subject'}), body at \${mail.messageId}\`)
}

export async function onBounce(request: SESRequest): Promise<SESResponse> {
  logger.info(\`Bounce from \${request.source} about \${request.subject ?? 'no subject'}\`)
}

export async function onSuspectEmail(request: SESRequest): Promise<SESResponse> {
  const { spamVerdict, virusVerdict } = request.receipt

  logger.info(\`Holding \${request.source}: spam \${spamVerdict.status}, virus \${virusVerdict.status}\`)

  return 'STOP_RULE_SET'
}`,
  },
]
</script>

<CodeFileViewer :files="files" id="ses-example" default-file="ses.ts" line-numbers collapse-toggle fixed-height />

The catch-all is registered last and takes everything the first two turned down, which is where spam
and a failed virus scan end up. Every verdict combination is covered that way, and without it a suspect
message addressed to `support@` would match nothing and throw.

`onSuspectEmail` returns `STOP_RULE_SET`, so a message that lands there stops the receipt rule set and
no later action delivers it. This only takes effect when the rule invokes the Lambda synchronously.

**A message addressed to both `support@` and `bounces@` matches whichever of those routes was
registered first**, since `recipient` matches on any one recipient. Read `recipients` in the handler
when a message reaching two of your addresses needs to do two things.

`index.ts` hands the router to `LambdaRouter`, which is what AWS invokes and what every router in the
Lambda gets registered on. See [routers](/docs/routers) for how the two levels of matching fit
together.
