# Service example: Connect

A deployable CDK app that exercises the `ConnectRouter` end to end. It models a parcel support desk.
One Lambda is the code hook for every Invoke AWS Lambda function block in a contact flow. The router
picks the handler for each block.

```
ler-example-connect-support (Amazon Connect contact flow)
├── escalateToSupervisor   (custom filter: priority parameter, wins over every step route)
├── greetChatCustomer      (chat, initiationMethod exact)
├── lookupOrder            (api, channel list)
├── checkDeliverySlot      (instanceArn exact)
├── offerCallback          (instanceArn pattern, initiationMethod list)
├── failAgentHandover      (custom filter, always throws)
├── recordFlowError        (custom filter, reached from an Error branch)
├── triageParcelEnquiry    (task, custom filter)
├── answerInboundCall      (inbound, channel exact)
├── dialOutboundSurvey     (outbound)
├── logTransferredContact  (transfer)
├── confirmCallbackBooked  (callback)
├── readEmailEnquiry       (email)
└── playHoldAnnouncement   (voice)
```

## What it covers

One `trigger` starts one chat contact and one task contact. The chat walks nine Invoke AWS Lambda
function blocks. Together they hit every filter the router has and both ways a contact can fail.

| Feature | Where |
| --- | --- |
| `custom` filter | `escalateToSupervisor` reads the `priority` parameter, and is async |
| `custom` filter over a step | `atStep` picks the route for five blocks that share a channel |
| `channel` filter | `answerInboundCall` matches `VOICE` |
| `channel` as a list | `lookupOrder` matches `VOICE` or `CHAT` |
| `initiationMethod` filter | `greetChatCustomer` matches `API` |
| `initiationMethod` as a list | `offerCallback` matches `API` or `INBOUND` |
| `instanceArn` filter | `checkDeliverySlot` matches the deployed instance by ARN |
| `instanceArn` as a pattern | `offerCallback` matches any Connect instance |
| `chat` and `api` methods | `greetChatCustomer` and `lookupOrder` register through them |
| `voice`, `email`, `inbound`, `outbound`, `transfer` and `callback` methods | The six telephony routes register through them |
| `route` method | `escalateToSupervisor`, `checkDeliverySlot`, `offerCallback`, `failAgentHandover` and `recordFlowError` |
| `defineRoute` | Those five take their request type from their filters, and `escalateToSupervisor` carries its middleware there |
| Router middleware | `logContact` runs once per matched contact |
| Route middleware | `withEscalationContext` on the escalation route |
| Match order | A high priority block reaches `escalateToSupervisor` on the same step others use for `lookupOrder` |
| No route matched | The refund block asks for a step no route claims |
| Handler failure | `failAgentHandover` throws after its middleware has run |
| Error branch | Both failures come back to `recordFlowError` through the block's Error branch |
| `task` method | `triageParcelEnquiry` takes the task contact, whose `TASK` channel only `ConnectChannel` carries |

CDK injects the instance ARN as an env var on the worker, and `src/config.ts` reads it. The
`instanceArn` filters match against that value.

The router has no schema support, so there is no validation failure to cover. A contact carries
metadata rather than a payload you control.

`ConnectChannel` and `ConnectInitiationMethod` follow the Connect service model, so they carry the
`TASK` channel and all twelve initiation methods. The `aws-lambda` unions are narrower than that. The
task contact is a delivered `TASK` channel, and `triageParcelEnquiry` is the route that claims it.

Six routes cannot be reached from either contact. `VOICE` needs telephony and `EMAIL` needs an email
channel. `INBOUND`, `OUTBOUND`, `TRANSFER` and `CALLBACK` each need a claimed phone number and a real
call. `scripts/checkRoutes.ts` drives all six in process instead.

Handlers prove what they did through their response and their logs. The flow stores each response as
a contact attribute, the trigger asserts those attributes, and CloudWatch holds the rest.

## Prerequisites

- AWS account with credentials on the shell
- `AWS_REGION` set to a region that offers Amazon Connect
- CDK bootstrap already run for the target account / region
- Node 24 and pnpm installed

Amazon Connect caps how many instances an account may create or delete in 30 days. Deploying and
tearing this down repeatedly will hit that cap, and the only fix is to wait.

## Permissions

`deploy-policy.json` holds the minimum permissions needed to deploy this example and test it. Attach
it to the user or role you run the commands with.

CloudFormation work is done by the CDK bootstrap roles, so the policy only allows assuming those
roles. The rest covers reading the stack outputs, starting the two contacts, reading their attributes
and reading the worker logs. Actions are locked down, resources are not.

Note: the policy assumes the default bootstrap qualifier `hnb659fds`. Change the role and parameter
ARNs if your account uses a custom one.

## Deploy

From this directory:

```bash
pnpm -F @lambda-event-router/service-example-connect build
pnpm -F @lambda-event-router/service-example-connect run deploy
```

CDK outputs include `InstanceId`, `InstanceArn`, `ContactFlowId`, `TaskFlowId` and
`WorkerLogGroupName`.

The instance alias becomes a hostname under `my.connect.aws`, so it has to be unique across all of
AWS. The stack builds it from the stack name and the account id.

The instance has inbound and outbound calls turned off and claims no phone number. It costs nothing
to leave up, and chat is the only channel it can take a contact on.

Connect refuses a flow naming a Lambda the instance is not associated with. The flow therefore
depends on the `AWS::Connect::IntegrationAssociation`.

## Start a sample contact

```bash
pnpm -F @lambda-event-router/service-example-connect trigger
```

The script reads the stack outputs itself, so it takes no arguments. Pass a stack name as the first
argument if you deployed with a different one.

It starts one chat contact with `orderRef` set to `AB-1029`. It then polls the contact attributes
until the flow sets `flowComplete`. It asserts the seven attributes the flow stored from handler
responses. A line per attribute says whether it passed.

Note: `StartChatContact` creates the contact but does not run the flow. The flow starts once the
customer holds the chat's websocket open. The trigger opens one and stands in for the chat client.
That websocket comes from the Connect participant service, which authorises on the participant token
rather than on IAM.

It then starts a task contact, which runs a flow of its own. A task arrives on the `TASK` channel,
and `triageParcelEnquiry` claims it. The trigger asserts the attribute that route stored, and that
none of the chat attributes appear on it.

Each run starts new contacts and the flow disconnects them at the end. Running the trigger twice in a
row gives the same answer, with no teardown in between.

Connect sends one contact per invocation and never batches, so nothing here shows partial failure or
ordering inside a batch.

## Checking the logs

Save the worker logs to a file:

```bash
aws logs tail /aws/lambda/ler-example-connect-worker --since 10m --format short > /tmp/ler-connect.log
```

Everything is synchronous and there is no dead letter queue. Give CloudWatch about 20 seconds after
the trigger finishes, or the export comes back empty.

Widen the window with `--since`, which takes a single unit such as `30m`, `2h` or `1d`. The worker
logs in JSON, so `--format json` pretty prints the fields.

Note: the log group is `/aws/lambda/<stackName>-worker`, so the name changes if you deploy with a
different `stackName`.

One trigger run puts 17 invocations in the log. Eleven of those are blocks the two flows reached.
Connect runs a failing block three times before it takes the Error branch, so the three failing
blocks add the other six.

Eleven invocations log `Handling Connect contact` from the router middleware. That line carries the
contact id, the channel, the initiation method and the step. Three of the eleven are the handover
block, once per attempt, because the router matched it every time.

Eight invocations succeed:

- `Chat customer greeted` reports `AB-1029`, which the trigger set as a contact attribute rather than
  a block parameter.
- `Order located` reports the same reference, this time read from the block parameter the flow filled
  in with `$.Attributes.orderRef`.
- `Delivery slot offered` reports `thursday-0900-1300`.
- `Callback offered` is the route that matched on the instance ARN pattern.
- `Priority contact received` then `Escalated to a supervisor` are the escalation route. The first
  line is its route middleware, which runs after `logContact` and only on this route.
- `Flow error recorded` appears twice, once with `failedStep` of `handOverToAgent` and once with
  `requestRefund`.
- `Parcel enquiry triaged` reports a `channel` of `TASK`. That is the task route, on a channel the
  `aws-lambda` union does not carry.

Nine invocations fail, and each leaves an `ERROR` record carrying `errorType`, `errorMessage` and a
`stackTrace`. There are three distinct messages, one per failing block, three attempts each:

- `No agent is free to take contact <id>` comes from the handler. That invocation has a `Handling
  Connect contact` line, because the middleware ran before the handler threw.
- `No route matched for Amazon Connect event (channel: CHAT, initiationMethod: API)` comes from the
  router. That invocation has no `Handling Connect contact` line. The router matches a route before
  it runs any middleware.
- `No route matched for Amazon Connect event (channel: TASK, initiationMethod: API)` is the refund
  block of the task flow, which no route claims on any channel.

Connect sends the two chat failures down the Error branch of their block. That branch invokes the
worker again at the `recordFlowError` step. The task flow has nothing after its refund block, so its
Error branch goes straight to the end.

Note: an invocation whose handler threw still reports a `status` of `success` in its
`platform.report` line. Count the `ERROR` records instead.

## Flow and routes

| Block | Parameters | Route |
| --- | --- | --- |
| `greet-invoke` | `step: greetCustomer` | `greetChatCustomer` |
| `lookup-invoke` | `step: lookupOrder` | `lookupOrder` |
| `slot-invoke` | `step: checkDeliverySlot` | `checkDeliverySlot` |
| `callback-invoke` | `step: offerCallback` | `offerCallback` |
| `escalation-invoke` | `step: lookupOrder`, `priority: high` | `escalateToSupervisor` |
| `handover-invoke` | `step: handOverToAgent` | `failAgentHandover`, which throws |
| `handover-error-invoke` | `step: recordFlowError` | `recordFlowError` |
| `refund-invoke` | `step: requestRefund` | none |
| `unrouted-error-invoke` | `step: recordFlowError` | `recordFlowError` |

The task flow runs two:

| Block | Parameters | Route |
| --- | --- | --- |
| `triage-invoke` | `step: triageEnquiry` | `triageParcelEnquiry` |
| `task-unrouted-invoke` | `step: requestRefund` | none |

A task needs a flow of its own. Every block of the chat flow filters on a step only a chat reaches,
so a task sent through it would match nothing after the first block.

Each block stores its response as a contact attribute through a Set contact attributes block, using
`$.External.<key>`. That is what the trigger reads back.

The chat runs nine blocks and takes 13 invocations, because `handover-invoke` and `refund-invoke` are
each attempted three times. The task flow runs two blocks and takes four.

No route filters on nothing, and none filters on `TASK`. Either would swallow a block that is meant
to reach its Error branch.

Every block validates the Lambda response as a `STRING_MAP`, which is the shape
`ConnectContactFlowResult` describes. Connect documents the values as alphanumeric, dash and
underscore only. Every handler here returns a token such as `thursday-0900-1300` and puts the prose
in its log line.

Connect caps a chain of Lambda invocations at 20 seconds in total, and any one block at 8 seconds.
Handlers here only log, so the nine blocks of the chat finish well inside that.

An unexpected failure on any other block jumps to the block that sets `flowComplete`. The trigger
then reports the missing attributes instead of timing out.

## Iterating

```bash
pnpm -F @lambda-event-router/service-example-connect check    # drive the routes in process
pnpm -F @lambda-event-router/service-example-connect diff     # review pending changeset
pnpm -F @lambda-event-router/service-example-connect watch    # hotswap deploys
pnpm -F @lambda-event-router/service-example-connect synth    # render template
```

`check` builds a Connect event for every block the deployed run makes. It adds the six routes the
chat cannot reach, a task contact and one contact from another instance. It asserts that each one
lands on the handler it should, and needs no AWS credentials.

## Tear down

```bash
pnpm -F @lambda-event-router/service-example-connect destroy
```

That removes the Connect instance, both contact flows, the Lambda association, the worker, its log
group and its role. Contacts started before the teardown go with the instance.
