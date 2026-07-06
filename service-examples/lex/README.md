# Service example: Lex

A deployable CDK app that exercises the `LexRouter` end to end. It models a parcel support bot. One
Lambda is the code hook for every intent, and the router picks the handler for each turn.

```
ParcelSupport (Amazon Lex V2 bot, en_GB)
├── escalateToSupervisor  (custom filter: accountTier session attribute, fulfilment)
├── checkTrackingNumber   (intentName list, dialog)
├── reportParcelLocation  (intentName exact, fulfilment)
├── cancelDelivery        (intentName wildcard, fulfilment)
├── bookRedelivery        (botId, invocationSource list, inputMode list)
└── handOverToAgent       (inputMode exact, always throws)
```

## What it covers

One `trigger` holds six conversations with the bot. Together they hit every filter the router has,
both convenience methods, and both ways a turn can fail.

| Feature | Where |
| --- | --- |
| `custom` filter | `escalateToSupervisor` reads the `accountTier` session attribute, and is async |
| `intentName` filter | `reportParcelLocation` matches `TrackParcel` exactly |
| `intentName` as a list | `checkTrackingNumber` matches `TrackParcel` or `CancelDelivery` |
| `intentName` as a wildcard | `cancelDelivery` matches `Cancel*` |
| `invocationSource` filter | `cancelDelivery` matches `FulfillmentCodeHook` on its own |
| `invocationSource` as a list | `bookRedelivery` matches either hook |
| `botId` filter | `bookRedelivery` matches the deployed bot by id |
| `inputMode` filter | `handOverToAgent` matches `Text` |
| `inputMode` as a list | `bookRedelivery` matches `Text` or `Speech` |
| `dialogCodeHook` method | `checkTrackingNumber` registers through it, typed to the dialog hook |
| `fulfillmentCodeHook` method | `reportParcelLocation` and `escalateToSupervisor` register through it |
| `route` method | `cancelDelivery`, `bookRedelivery` and `handOverToAgent` register through it |
| `defineRoute` | The three `route` handlers take their request type from their filters, and `cancelDelivery` carries its middleware there |
| Router middleware | `logTurn` runs once per matched turn |
| Route middleware | `withAccountContext` on the escalation route, `withCancellationAudit` on `cancelDelivery` |
| Match order | A priority account reaches `escalateToSupervisor` on the same utterance others use for `bookRedelivery` |
| No route matched | The fallback intent reaches the worker and matches nothing |
| Handler failure | `handOverToAgent` throws after its middleware has run |

CDK injects the bot id as an env var on the worker, and `src/config.ts` reads it. The `botId` filter
matches against that value.

Handlers prove what they did through their response and their logs. The trigger asserts the response
Lex sends back, and CloudWatch holds the rest.

Three filter values cannot be reached from a text conversation. `inputMode` of `Speech` needs audio
and `DTMF` needs a telephony channel. A `botId` that does not match needs a second bot.
`scripts/checkRoutes.ts` drives all three in process instead.

## Prerequisites

- AWS account with credentials on the shell
- `AWS_REGION` set to a region that offers Amazon Lex V2
- CDK bootstrap already run for the target account / region
- Node 24 and pnpm installed

## Permissions

`deploy-policy.json` holds the minimum permissions needed to deploy this example and test it. Attach
it to the user or role you run the commands with.

CloudFormation work is done by the CDK bootstrap roles, so the policy only allows assuming those
roles. The rest covers reading the stack outputs, talking to the bot and reading the worker logs.
Actions are locked down, resources are not.

Note: the policy assumes the default bootstrap qualifier `hnb659fds`. Change the role and parameter
ARNs if your account uses a custom one.

## Deploy

From this directory:

```bash
pnpm -F @lambda-event-router/service-example-lex build
pnpm -F @lambda-event-router/service-example-lex run deploy
```

CDK outputs include `BotId`, `BotAliasId`, `LocaleId` and `WorkerLogGroupName`.

The deploy builds the bot locale as well as creating it. The code hook sits on the test alias, which
always points at the draft bot. An edited intent therefore reaches the alias on the next deploy, with
no bot version to cut.

The bot holds the worker ARN as a literal string rather than a CloudFormation reference. The worker
takes the bot id as an env var, so a reference the other way would be a cycle.

The bot is reachable by anyone who can call Lex in the account while the stack is up. It holds two
hard-coded parcels and writes nothing down.

## Send sample utterances

```bash
pnpm -F @lambda-event-router/service-example-lex trigger
```

The script reads the stack outputs itself, so it takes no arguments. Pass a stack name as the first
argument if you deployed with a different one.

It sends nine utterances across six conversations. Each turn is asserted on the message Lex returns
and on the intent it resolved. A line per turn says whether it passed.

Every run uses fresh session ids, so running it twice in a row gives the same answer.

Lex sends one turn per invocation and never batches, so nothing here shows partial failure or
ordering inside a batch.

Two of the nine turns produce two invocations. The dialog hook delegates once the tracking number is
valid. Lex then calls the fulfilment hook in the same turn.

## Checking the logs

Save the worker logs to a file:

```bash
aws logs tail /aws/lambda/ler-example-lex-worker --since 10m --format short > /tmp/ler-lex.log
```

Everything is synchronous. There are no retries and no dead letter queue. Give CloudWatch about 20
seconds after the trigger finishes, or the export comes back empty.

Widen the window with `--since`, which takes a single unit such as `30m`, `2h` or `1d`. The worker
logs in JSON, so `--format json` pretty prints the fields.

Note: the log group is `/aws/lambda/<stackName>-worker`, so the name changes if you deploy with a
different `stackName`.

One trigger run puts 11 invocations in the log. Ten of them log `Handling Lex turn` from the router
middleware, which carries the intent, the hook, the input mode and the bot id.

Nine invocations succeed:

- `Tracking number rejected` appears three times. Twice the slot is empty and the caller is asked for
  it. Once it holds `XY12` and the caller is told the format.
- `Tracking number accepted` appears twice, once per tracking intent. Both delegate back to Lex.
- `Parcel located` reports `AB123456` as out for delivery in Leeds.
- `Cancellation requested` then `Delivery cancelled` are the cancellation route, which matched the
  `Cancel*` wildcard. The first line is the route middleware `defineRoute` carries.
- `Redelivery booked` carries the bot id the `botId` filter matched on.
- `Priority account turn` then `Escalated to a supervisor` are the escalation route. The first line
  is its route middleware. That middleware runs after `logTurn` and only on this route.

Two invocations fail, and each leaves an `ERROR` record carrying `errorType`, `errorMessage` and a
`stackTrace`:

- `No agent is free to take "speak to an agent"` comes from the handler. That invocation has a
  `Handling Lex turn` line, because the middleware ran before the handler threw.
- `No route matched for Amazon Lex event (intent: FallbackIntent, invocationSource:
  FulfillmentCodeHook)` comes from the router. That invocation has no `Handling Lex turn` line. The
  router matches a route before it runs any middleware.

Lex answers both failures with the intent's configured failure response. The intent state comes back
as `Failed`, and the trigger asserts both.

Note: an invocation whose handler threw still reports a `status` of `success` in its
`platform.report` line. Count the `ERROR` records instead.

## Bots and routes

| Intent | Hooks enabled | Route |
| --- | --- | --- |
| `TrackParcel` | dialog, fulfilment | `checkTrackingNumber`, then `reportParcelLocation` |
| `CancelDelivery` | dialog, fulfilment | `checkTrackingNumber`, then `cancelDelivery` |
| `BookRedelivery` | fulfilment | `bookRedelivery`, or `escalateToSupervisor` on a priority account |
| `SpeakToAgent` | fulfilment | `handOverToAgent` |
| `FallbackIntent` | fulfilment | none |

`escalateToSupervisor` is registered first, so it takes every fulfilment turn on a priority account
whatever the intent.

## Iterating

```bash
pnpm -F @lambda-event-router/service-example-lex check    # drive the routes in process
pnpm -F @lambda-event-router/service-example-lex diff     # review pending changeset
pnpm -F @lambda-event-router/service-example-lex watch    # hotswap deploys
pnpm -F @lambda-event-router/service-example-lex synth    # render template
```

`check` builds a Lex event for every turn the deployed run makes, plus three the conversation cannot
reach. It asserts that each one lands on the handler it should. It needs no AWS credentials.

## Tear down

```bash
pnpm -F @lambda-event-router/service-example-lex destroy
```

That removes the bot, its test alias, the worker, its log group and both roles. Open Lex sessions
expire on their own five minutes after the last turn.
