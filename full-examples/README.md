# Examples

A collection of working Latcher examples where each one can be deployed to AWS with a few commands.

Each example is self-contained. You can deploy the code by following the steps in the README.

They are intended to demonstrate how latcher works. Some examples may not follow best practices and may include unusual design choices, as the focus is on showing different features of the library.

## Deploy tools

Each example uses a different deploy tool, so you can see the matcher with the one you already use.

| Example | Tool |
| --- | --- |
| `http-api-dynamodb-sqs` | AWS CDK |
| `cognito-eventbridge-s3-avatars` | AWS SAM |
| `secretsmanager-eventbridge-cloudwatch-security` | Terraform |

The matcher code is the same whichever tool deploys it. Only the bundle step changes. CDK bundles the
TypeScript itself. For SAM and Terraform, each example has a `bundle` script that runs esbuild first.

SAM suits an app that is mostly Lambda functions and their triggers. Terraform suits a team that
already uses it, or a stack with many resources that are not Lambda.
