# Service example: Cognito

A deployable CDK app that exercises the `CognitoRouter` end to end. It models an applicant portal.
Two user pools send every Lambda trigger to the same worker, and the router dispatches on the
trigger source.

```
applicants pool
├── preSignUp, postConfirmation
├── preAuthentication, postAuthentication, preTokenGeneration
├── defineAuthChallenge, createAuthChallenge, verifyAuthChallengeResponse
├── userMigration
└── customMessage

staff pool
├── preSignUp, postConfirmation
└── customEmailSender
```

## What it covers

One `trigger` run drives both pools through sign-up, confirmation, sign-in, token refresh, a custom
auth challenge, a migration and a password reset. Together they hit every filter, every registration
style and all three failure paths.

| Feature | Where |
| --- | --- |
| `triggerSource` filter | Every route. `recordAdminCreatedUser` sets it by hand through `route()` |
| `userPoolId` filter | The two staff sign-up routes. An applicant sign-up falls past both |
| `clientId` filter | `recordAdminCreatedUser` matches `CLIENT_ID_NOT_APPLICABLE`, self sign-ups fall past it |
| `userAttributes` filter | A list of departments on staff, the `msc-*` wildcard on applicants |
| `custom` filter | `rejectTestAccount` reads `userName`, which no other filter sees |
| Zod schema | `StaffAttributesSchema` on the senior staff route |
| Router middleware | `logInvocation` runs once per event |
| Route middleware | `withDepartment` on the senior staff route |
| Family methods | `preTokenGeneration`, `customMessage`, `customEmailSender`, `userMigration` |
| Single source methods | `preSignUpSignUp`, `postConfirmationConfirmSignUp` and the rest |
| `route()` | `recordAdminCreatedUser`, typed against the wide request union |
| No route matched | An applicant whose programme is not a taught masters |
| Schema failure | A staff sign-up with no staff number |
| Handler failure | `rejectTestAccount` blocks a sign-up, `blockWithdrawnApplicant` blocks a sign-in |
| Response fields | Auto-confirmation, token claims, challenge parameters and migrated attributes |

Handlers prove what they did by logging. The sign-in flows also prove it in the ID token, which the
trigger script decodes and checks against the claims the router added.

The staff pool has a custom email sender trigger, so Cognito sends none of its mail. The worker gets
the verification code instead, decrypts it with the pool's KMS key and logs it. The applicant pool
keeps Cognito's own sending and addresses users at the SES mailbox simulator, so nothing reaches a
real inbox.

Every user gets its own simulator address. Cognito counts code sends per address and rejects a
sign-up with `LimitExceededException` once an address is over its limit. A shared address stops the
run after the first code goes out.

Only an admin creation sends `CLIENT_ID_NOT_APPLICABLE` as the client id. An admin confirmation sends
no client id at all, even though the event type says there is one. The router skips a `clientId`
filter when the id is missing, so no route can match on it being absent.

A pool holds the ARN of the Lambda it triggers, so CloudFormation rejects a template that also puts
the pool's id in that Lambda's environment. CDK injects the two pool names instead, and `src/config.ts`
turns them into ids once per cold start. The `userPoolId` filters match against those.

Six trigger sources are out of reach here and only the package's unit tests cover them.
`PreSignUp_ExternalProvider` needs a federated identity provider. `TokenGeneration_HostedAuth` needs
a browser sign-in through the hosted UI. `TokenGeneration_AuthenticateDevice` needs device tracking
and a device sign-in. `CustomMessage_Authentication` and `CustomEmailSender_Authentication` need SMS
MFA. `CustomEmailSender_AccountTakeOverNotification` needs threat protection, which needs the Plus
feature plan.

## Prerequisites

- AWS account with credentials on the shell
- CDK bootstrap already run for the target account / region
- Node 24 and pnpm installed

## Permissions

`deploy-policy.json` holds the minimum permissions needed to deploy this example and test it. Attach
it to the user or role you run the commands with.

CloudFormation work is done by the CDK bootstrap roles, so the policy only allows assuming those
roles. The rest covers driving the user pools and reading the worker logs. Actions are locked down,
resources are not.

Note: the policy assumes the default bootstrap qualifier `hnb659fds`. Change the role and parameter
ARNs if your account uses a custom one.

## Deploy

From this directory:

```bash
pnpm -F @lambda-event-router/service-example-cognito build
pnpm -F @lambda-event-router/service-example-cognito run deploy
```

CDK outputs include `ApplicantsPoolId`, `ApplicantsClientId`, `StaffPoolId`, `StaffClientId` and
`WorkerLogGroupName`. The trigger script reads them from the stack, so you do not need to copy them.

## Trigger sample user flows

```bash
pnpm -F @lambda-event-router/service-example-cognito trigger
```

Pass a stack name as the first argument if you deployed with one other than `ler-example-cognito`.
Set `AWS_REGION` first, because the script fails without it.

Every username carries a run id, so running the command twice in a row works with no teardown in
between. The script prints one line per step and throws on the first result that does not match.

Five of the calls are meant to fail. The script asserts the error each one returns, so a clean exit
means the failure paths behaved as well as the successful ones.

One step waits on the log. Cognito never hands a real reset code to the caller, so the script reads
the code the custom email sender decrypted out of the worker's log group before it confirms the
reset. That wait can take up to 90 seconds.

## Checking the logs

Save the worker logs to a file:

```bash
aws logs tail /aws/lambda/ler-example-cognito-worker --since 15m --format short > /tmp/worker.log
```

Wait about 30 seconds after the script finishes for the last lines to land. Export once and work
from the file. Widen the window with `--since`, which takes a single unit such as `30m`, `2h` or
`1d`. The worker logs in JSON, so `--format json` pretty prints the fields.

Note: the log group is `/aws/lambda/<stackName>-worker`, so the name changes if you deploy with a
different `stackName`.

One run is 54 invocations. 52 carry a `Handling Cognito trigger` line naming the trigger source, the
pool and the app client. The two without it are the schema failure and the unmatched sign-up, because
the router validates and matches before any middleware runs.

`Admin created a user` appears four times. Two are the invited staff member and the invited applicant.
The other two are the migrated users, because Cognito runs the pre sign-up trigger as an admin
creation when a migration makes an account.

The staff pool produces:

- `Staff sign-up received` then `Senior staff sign-up confirmed` for the admissions sign-up. The first
  line is the route middleware, the second the handler. The SignUp response comes back
  `UserConfirmed: true`, which is `autoConfirmUser` taking effect.
- `Staff sign-up waiting on email confirmation` once, for the finance sign-up. It misses the
  department filter and falls to the next route.
- `Staff code decrypted` six times, once per `CustomEmailSender_*` source the run reaches: the finance
  sign-up, its resent code, the senior staff reset, an email verification, an email change and the
  invitation. The `code` field holds a six digit plaintext, which is what proves the KMS decrypt ran.
- `Password reset completed` once, after the script confirms the reset with that code.

The applicant pool produces:

- `Applicant queued for review` twice, for the taught masters applicant and the withdrawn one.
- `User provisioned` three times: the staff auto-confirmation and the two admin confirmations.
- `Sign-in allowed` three times and `Sign-in completed` five times. Pre authentication runs four
  times and one of those throws. The invited applicant's new password flow completes authentication
  twice.
- `Sign-in token claims added` five times. The ID token carries `programme` and `tokenSource`, which
  is `claimsOverrideDetails` taking effect, and the trigger script asserts both claims.
- `Refresh token claims added` once, with no sign-in lines around it, because a refresh runs neither
  authentication trigger.
- `Auth challenge decided` four times, `Auth challenge created` twice and `Auth challenge answered`
  twice. Each custom auth round is decide, create, answer, decide.
- `answerCorrect: true` then `issueTokens: true` for the right answer. The wrong answer gives
  `answerCorrect: false` then `failAuthentication: true`, and the caller a `NotAuthorizedException`.
- `Legacy applicant migrated` twice, once for a sign-in and once for a password reset. The sign-in
  returns tokens for a user who never signed up.
- `Reset email written` once, for the migrated user's reset code. That is the one message source the
  single source route takes ahead of the family route.
- `Cognito default message left in place` seven times across six sources: two sign-ups, a resent code,
  an email verification, an email change and two admin invitations.

A sign-in runs pre authentication, then post authentication, then token generation. A custom auth
sign-in skips pre authentication altogether, so those rounds produce no `Sign-in allowed` line.

Four records are errors:

- `Test accounts cannot sign up` from `rejectTestAccount`. It has a `Handling Cognito trigger` line,
  because the filter matched and the middleware ran.
- `Applicant ... has withdrawn` from `blockWithdrawnApplicant`, also with that line.
- `No route matched for trigger PreSignUp_SignUp` for the doctoral applicant, without one.
- `User attributes validation failed for trigger PreSignUp_SignUp` for the staff sign-up with no staff
  number, also without one. It carries an `issues` array naming `custom:staffNumber`.

Read `errorMessage` rather than `errorType` on those records. The bundle is minified, so a router
error class arrives as a two character `errorType` with its real name in `name`.

The wrong custom auth answer is the one failure with no error record. Failing authentication is a
value the handler returns rather than a throw.

Note: an invocation whose handler threw still reports a `status` of `success` in its
`platform.report` line. Count the `ERROR` records instead.

## Pools and routes

| Pool | Triggers wired | Sends its own mail |
| --- | --- | --- |
| `ApplicantsPool` | 10 | Yes, to the SES mailbox simulator |
| `StaffPool` | 3 | No, the custom email sender takes it |

The narrowest route is tried first, so a route filtered on nothing but its trigger source takes what the
more specific ones turn down.

| Route | Trigger source | Picked out by |
| --- | --- | --- |
| `rejectTestAccount` | `PreSignUp_SignUp` | `custom`, a username starting `test-` |
| `autoConfirmSeniorStaff` | `PreSignUp_SignUp` | Staff pool, department admissions or registry |
| `holdStaffSignUp` | `PreSignUp_SignUp` | Staff pool |
| `queueApplicantReview` | `PreSignUp_SignUp` | Applicants pool, programme matching `msc-*` |
| `recordAdminCreatedUser` | All three `PreSignUp_*` | `clientId` of `CLIENT_ID_NOT_APPLICABLE`, through `route()` |
| `provisionUser` | `PostConfirmation_ConfirmSignUp` | The trigger source alone |
| `recordPasswordReset` | `PostConfirmation_ConfirmForgotPassword` | The trigger source alone |
| `blockWithdrawnApplicant` | `PreAuthentication_Authentication` | The trigger source alone |
| `logSignIn` | `PostAuthentication_Authentication` | The trigger source alone |
| `markRefreshedToken` | `TokenGeneration_RefreshTokens` | The trigger source alone |
| `addApplicantClaims` | The other four `TokenGeneration_*` | The family method |
| `defineApplicantChallenge` | `DefineAuthChallenge_Authentication` | The trigger source alone |
| `createApplicantChallenge` | `CreateAuthChallenge_Authentication` | The trigger source alone |
| `verifyApplicantChallenge` | `VerifyAuthChallengeResponse_Authentication` | The trigger source alone |
| `migrateLegacyApplicant` | Both `UserMigration_*` | The family method |
| `writeResetEmail` | `CustomMessage_ForgotPassword` | The trigger source alone |
| `logDefaultMessage` | The other six `CustomMessage_*` | The family method |
| `deliverStaffCode` | The eight `CustomEmailSender_*` | The family method |

## Iterating

```bash
pnpm -F @lambda-event-router/service-example-cognito diff   # review pending changeset
pnpm -F @lambda-event-router/service-example-cognito watch  # hotswap deploys
pnpm -F @lambda-event-router/service-example-cognito synth  # render template
```

## Tear down

```bash
pnpm -F @lambda-event-router/service-example-cognito destroy
```

Destroying the stack deletes both pools and every user in them. The KMS key is the one thing left
behind. AWS only accepts a scheduled deletion for a key, so `destroy` puts it into a seven day
pending window and it disappears at the end of that. It costs $1 a month until then.
