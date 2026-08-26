# Full example: Cognito, EventBridge and S3 avatars with AWS SAM

An AWS SAM app that keeps a black and white avatar for each user in a Cognito user pool. Cognito,
EventBridge and S3 events all go to one Lambda:

```
Cognito user pool
├── PostConfirmation (sign-up confirmed)
│   └── userController / postConfirmation (cognitoRouter)
│       └── Gravatar image put to originals/<userName>.<ext>
├── CustomMessage (email change)
│   └── userController / customMessageUpdateAttribute (cognitoRouter)
│       └── Gravatar image for the new email put to originals/<userName>.<ext>
├── CustomMessage (every other source)
│   └── userController / keepDefaultMessage (cognitoRouter)
└── AdminDeleteUser or DeleteUser
    └── CloudTrail
        └── EventBridge rule
            └── userController / userDeleted (eventBridgeRouter)
                └── originals/<userName>.* deleted

S3 avatars bucket
├── ObjectCreated on originals/*.jpg, *.jpeg or *.png
│   └── userController / convertToBlackAndWhite (s3Router)
│       └── black and white copy put to processed/<userName>.<ext>
└── ObjectRemoved on originals/*
    └── userController / cleanupProcessed (s3Router)
        └── processed/<userName>.<ext> deleted
```

The steps to run it are in [Prerequisites](#prerequisites), [Permissions](#permissions)
and [Deploy](#deploy).

There are 6 routes on one Lambda function. `src/index.ts` has one `LambdaRouter` that combines all
three routers. Users with no Gravatar get a 1 pixel placeholder image.

## Email change

Cognito has no trigger that runs after a user verifies a new email. The closest is the
`CustomMessage_UpdateUserAttribute` trigger, which runs while Cognito sends the verification code.

The trigger event only carries the new address if Cognito changes the email straight away. So the
pool does not set `AttributesRequireVerificationBeforeUpdate`, and the email changes before the
user verifies it.

Note: this lets a user sign in with an address they have not proved they own. A real app should
keep the setting and update the avatar after verification instead.

## Usernames

The pool uses email as the username, so Cognito gives each user a generated `userName`. It is the
same value as the user's `sub`, and the S3 keys use it.

CloudTrail hides the username in `AdminDeleteUser` and `DeleteUser` events. The events carry the
`sub` in `additionalEventData`, so `userDeleted` finds the avatars with that.

EventBridge only receives CloudTrail events while a trail is logging. The template creates a trail
for the region, with its own bucket.

## Prerequisites

- AWS account with credentials on the shell
- `AWS_REGION` set to the region to deploy to
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) installed
- Node 24 and pnpm installed

The first `sam deploy` in a region creates the `aws-sam-cli-managed-default` stack. It holds the
bucket SAM uploads code to, and every SAM app in the region shares it.

## Permissions

`deploy-policy.json` holds the permissions needed to deploy this example and test it. Attach it to
the user or role you run the commands with.

CloudFormation creates each resource with your credentials, so the policy covers creating and
deleting every resource. It also covers the Cognito calls below and reading the logs. Actions are
locked down, resources are not.

## Deploy

```bash
pnpm -F @lambda-event-router/full-example-cognito-eventbridge-s3-avatars... install
pnpm -F @lambda-event-router/full-example-cognito-eventbridge-s3-avatars... build
pnpm -F @lambda-event-router/full-example-cognito-eventbridge-s3-avatars run deploy
```

`deploy` bundles `src/index.ts` into `dist/` with esbuild, then runs `sam deploy`.

The example does not use `sam build`. It runs `npm install`, which cannot resolve the `workspace:*`
versions in `package.json`.

## Playing around

Use an email address you can read for `EMAIL`, because Cognito sends codes to it. An address with a
Gravatar shows the black and white conversion best.

```bash
export STACK=cognito-eventbridge-s3-avatars
output() {
  aws cloudformation describe-stacks --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}
export USER_POOL_ID=$(output UserPoolId)
export CLIENT_ID=$(output UserPoolClientId)
export BUCKET=$(output BucketName)
export EMAIL=you@example.com
export NEW_EMAIL=you+new@example.com

# 1. Sign up a user
aws cognito-idp sign-up --client-id "$CLIENT_ID" --username "$EMAIL" --password 'Password1!' \
  --user-attributes Name=email,Value="$EMAIL"

# 2. Confirm the user without the emailed code
aws cognito-idp admin-confirm-sign-up --user-pool-id "$USER_POOL_ID" --username "$EMAIL"

# 3. List both avatars
aws s3 ls "s3://$BUCKET/" --recursive

# 4. Change the email
aws cognito-idp admin-update-user-attributes --user-pool-id "$USER_POOL_ID" --username "$EMAIL" \
  --user-attributes Name=email,Value="$NEW_EMAIL"

# 5. Delete the user, who now signs in with the new email
aws cognito-idp admin-delete-user --user-pool-id "$USER_POOL_ID" --username "$NEW_EMAIL"

# 6. List the avatars again. Both are gone.
aws s3 ls "s3://$BUCKET/" --recursive
```

Step 5 can take a few minutes to show in step 6, because CloudTrail delivers the event to
EventBridge after a delay.

## Checking the logs

Save the function logs to a file:

```bash
aws logs tail /aws/lambda/cognito-eventbridge-s3-avatars-user-controller --since 10m --format short > avatars.log
```

You see, in order:

1. Step 1 logs `Cognito default message left in place` with `triggerSource: CustomMessage_SignUp`.
2. Step 2 logs `Avatar created for new user`, then `Avatar converted to black and white`.
3. Step 4 logs `Avatar updated for new email`, then `Avatar converted to black and white`.
4. Step 5 logs `Avatars deleted for removed user`, then `Processed avatar removed`.

If the new email's image has a different file type, step 4 also logs `Processed avatar removed` for
the old image.

## Tear down

```bash
pnpm -F @lambda-event-router/full-example-cognito-eventbridge-s3-avatars destroy
```

`destroy` stops the trail and empties both buckets, then runs `sam delete`. CloudFormation cannot
delete a bucket that still has objects in it.

Note: the trail can deliver one last log file after it stops. If `sam delete` fails on the trail
bucket, run `destroy` again.

The `aws-sam-cli-managed-default` stack stays, because other SAM apps use it.
