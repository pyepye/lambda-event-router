<p align="center">
    <img src="./docs/public/latcher.svg" width="200px" align="center" alt="Latcher logo" />
  <h1 align="center">Latcher</h1>
</p>

A TypeScript framework for routing AWS Lambda events. You define matchers for the AWS services you care about - SQS, API Gateway, DynamoDB Streams, S3 and more - and the framework matches your handlers with each event.

This is useful when you want a single Lambda (or a set of Lambdas with shared code) to handle events from multiple sources. Instead of writing your own event detection logic, you declare filters and handlers and let the matcher do the matching.

The full documentation is at [pyepye.github.io/latcher](https://pyepye.github.io/latcher/).

<br />


```ts
import { Latcher } from '@latcher/base'
import { apiGatewayMatcher } from './api'
import { sqsMatcher } from './sqs'
import { dynamoDBMatcher } from './dynamo'
import { s3Matcher } from './s3'

const latcher = new Latcher({
  matchers: [apiGatewayMatcher, sqsMatcher, dynamoDBMatcher, s3Matcher]
})

export const handler = latcher.handler()
```


## Features

- **Multi-source routing** - Combine matchers from different AWS services in a single Lambda handler
- **Type-safe** - Full TypeScript support with handler types inferred from the schemas and filters on the route
- **Declarative filters** - Route events by service-specific data - ARN, eventType, topic, bucket, event name, detail type and custom filter functions. Where two routes overlap, the more specific one is tried first, whatever order you registered them in
- **Native support for 25 AWS services** - Includes dedicated matchers for SQS, SNS, EventBridge, DynamoDB Streams, S3, API Gateway, and more. Any service that emits Lambda events is supported out of the box.
- **Works with any AWS service** - Even services without native Lambda support can be integrated using CloudTrail and EventBridge using the EventBridgeMatcher.
- **Schema validation** - Built-in validation for request bodies, message attributes, path params and more. Works with any Standard Schema library
- **Well tested** - Clear tests covering most code branches for each event type

This framework isn't the right fit in every situation. See [When not to use it](#when-not-to-use-it) for more details.


## Packages / Supported AWS services

Below is an overview of the packages and matchers included. Each package can be installed individually.

For usage details, check the individual READMEs linked in the table.

| Service | Feature / Event Source | Package | Matcher | Link |
|---------|----------------------|---------|--------|------|
| Amazon API Gateway | REST API | [`@latcher/apigateway`](packages/apigateway/README.md) | `APIGatewayMatcher` | [README](packages/apigateway/README.md) |
| Amazon API Gateway | HTTP API | [`@latcher/apigateway`](packages/apigateway/README.md) | `APIGatewayMatcher` | [README](packages/apigateway/README.md) |
| Amazon API Gateway | WebSocket | [`@latcher/apigateway`](packages/apigateway/README.md) | `WebSocketMatcher` | [README](packages/apigateway/README.md) |
| Amazon API Gateway | Lambda Authorizer | [`@latcher/apigateway`](packages/apigateway/README.md) | `LambdaAuthorizerMatcher` | [README](packages/apigateway/README.md) |
| Elastic Load Balancing | Application Load Balancer | [`@latcher/alb`](packages/alb/README.md) | `ALBMatcher` | [README](packages/alb/README.md) |
| Amazon VPC Lattice | VPC Lattice | [`@latcher/vpclattice`](packages/vpclattice/README.md) | `VPCLatticeMatcher` | [README](packages/vpclattice/README.md) |
| Amazon SQS | Queue | [`@latcher/sqs`](packages/sqs/README.md) | `SQSMatcher` | [README](packages/sqs/README.md) |
| Amazon SNS | Topic notification | [`@latcher/sns`](packages/sns/README.md) | `SNSMatcher` | [README](packages/sns/README.md) |
| Amazon DynamoDB | Streams | [`@latcher/dynamodb`](packages/dynamodb/README.md) | `DynamoDBMatcher` | [README](packages/dynamodb/README.md) |
| Amazon Kinesis | Data Streams | [`@latcher/kinesis`](packages/kinesis/README.md) | `KinesisMatcher` | [README](packages/kinesis/README.md) |
| Amazon Data Firehose | Transformation | [`@latcher/firehose`](packages/firehose/README.md) | `FirehoseMatcher` | [README](packages/firehose/README.md) |
| Amazon MSK / Self-managed | Kafka | [`@latcher/kafka`](packages/kafka/README.md) | `KafkaMatcher` | [README](packages/kafka/README.md) |
| Amazon MQ | ActiveMQ | [`@latcher/mq`](packages/mq/README.md) | `ActiveMQMatcher` | [README](packages/mq/README.md) |
| Amazon MQ | RabbitMQ | [`@latcher/mq`](packages/mq/README.md) | `RabbitMQMatcher` | [README](packages/mq/README.md) |
| Amazon DocumentDB | Change Streams | [`@latcher/documentdb`](packages/documentdb/README.md) | `DocumentDBMatcher` | [README](packages/documentdb/README.md) |
| Amazon EventBridge | Rule | [`@latcher/eventbridge`](packages/eventbridge/README.md) | `EventBridgeMatcher` | [README](packages/eventbridge/README.md) |
| Amazon EventBridge | Pipe | [`@latcher/eventbridge`](packages/eventbridge/README.md) | `EventBridgeMatcher` | [README](packages/eventbridge/README.md) |
| Amazon EventBridge | Bus | [`@latcher/eventbridge`](packages/eventbridge/README.md) | `EventBridgeMatcher` | [README](packages/eventbridge/README.md) |
| Amazon EventBridge | Scheduler | [`@latcher/base`](packages/base/README.md) | `EventMatcher` | [README](packages/base/README.md) |
| Amazon S3 | Object notification | [`@latcher/s3`](packages/s3/README.md) | `S3Matcher` | [README](packages/s3/README.md) |
| Amazon S3 | Batch Operations | [`@latcher/s3`](packages/s3/README.md) | `S3BatchMatcher` | [README](packages/s3/README.md) |
| Amazon CloudWatch | Logs subscription filter | [`@latcher/cloudwatch`](packages/cloudwatch/README.md) | `CloudWatchLogsMatcher` | [README](packages/cloudwatch/README.md) |
| AWS Step Functions | Task | [`@latcher/stepfunctions`](packages/stepfunctions/README.md) | `StepFunctionsMatcher` | [README](packages/stepfunctions/README.md) |
| AWS CodePipeline | Job | [`@latcher/codepipeline`](packages/codepipeline/README.md) | `CodePipelineMatcher` | [README](packages/codepipeline/README.md) |
| Amazon Cognito | User Pool triggers | [`@latcher/cognito`](packages/cognito/README.md) | `CognitoMatcher` | [README](packages/cognito/README.md) |
| AWS AppSync | Resolver | [`@latcher/appsync`](packages/appsync/README.md) | `AppSyncMatcher` | [README](packages/appsync/README.md) |
| AWS AppSync | Authorizer | [`@latcher/appsync`](packages/appsync/README.md) | `AppSyncAuthorizerMatcher` | [README](packages/appsync/README.md) |
| AWS AppSync | Events | [`@latcher/appsync`](packages/appsync/README.md) | `AppSyncEventsMatcher` | [README](packages/appsync/README.md) |
| Amazon SES | Email receipt | [`@latcher/ses`](packages/ses/README.md) | `SESMatcher` | [README](packages/ses/README.md) |
| Amazon Connect | Contact flow | [`@latcher/connect`](packages/connect/README.md) | `ConnectMatcher` | [README](packages/connect/README.md) |
| Amazon Lex | Bot (v2) | [`@latcher/lex`](packages/lex/README.md) | `LexMatcher` | [README](packages/lex/README.md) |
| AWS Secrets Manager | Rotation | [`@latcher/secretsmanager`](packages/secretsmanager/README.md) | `SecretsManagerMatcher` | [README](packages/secretsmanager/README.md) |
| AWS Config | Custom Rule | [`@latcher/config`](packages/config/README.md) | `ConfigMatcher` | [README](packages/config/README.md) |
| AWS Config | Scheduled Rule | [`@latcher/config`](packages/config/README.md) | `ConfigScheduledMatcher` | [README](packages/config/README.md) |
| AWS CodeCommit | Repository trigger | [`@latcher/codecommit`](packages/codecommit/README.md) | `CodeCommitMatcher` | [README](packages/codecommit/README.md) |
| AWS CloudFormation | Custom Resource | [`@latcher/cloudformation`](packages/cloudformation/README.md) | `CloudFormationMatcher` | [README](packages/cloudformation/README.md) |
| AWS IoT Core | Rules Engine action | [`@latcher/iot`](packages/iot/README.md) | `IoTMatcher` | [README](packages/iot/README.md) |


## Quick start

Install the base package and the service matcher you need:

```bash
npm install @latcher/base @latcher/[package]
```

For example, to install matchers for apigateway and sqs

```bash
npm install @latcher/base @latcher/apigateway @latcher/sqs
```


## Basic usage

Here's a quick look at how you define handlers. For the full details on each matcher, check their individual READMEs.

```ts
// main handler
import { Latcher } from '@latcher/base'
import { apiMatcher } from './api'
import { sqsMatcher } from './sqs'

const latcher = new Latcher({
  matchers: [apiMatcher, sqsMatcher]
})

export const handler = latcher.handler()
```

```ts
// api.ts
import { createAPIGatewayMatcher } from '@latcher/apigateway'

const apiMatcher = createAPIGatewayMatcher()

apiMatcher.route({
  filters: {
    method: 'POST',
    path: '/order/:id/',
  },
  handler: createOrder // Puts message on an SQS queue with a message attribute of ProcessOrder (string)
})
```

```ts
// sqs.ts
import { createSQSMatcher } from '@latcher/sqs'
import { processOrder } from './order/process'
import { refundOrder } from './order/refund'

const sqsMatcher = createSQSMatcher()

sqsMatcher.route({
  filters: {
    messageAttributes: {
      Type: 'ProcessOrder',
    }
  },
  handler: processOrder
})

sqsMatcher.route({
  filters: {
    messageAttributes: {
      Type: 'RefundOrder',
    }
  },
  handler: refundOrder
})
```


## Testing

[`@latcher/testing`](packages/testing/README.md) builds AWS events for your tests, with a Vitest fixture for every supported service. See the [testing docs](docs/testing/index.md) for the builders, mock context and mock schemas.


## Examples

The [service-examples](service-examples/) directory has one deployable app per AWS service. Each one has a README with the deploy steps, a script that triggers it and a walk through the logs it produces.

The [full-examples](full-examples/) directory has apps that chain several AWS services through a single flow.


## When not to use it

If your Lambda handles a single event source in a single way, you probably don't need this. Here are some cases where it isn't the right fit:

- **Single event source with no filtering** - Your Lambda receives events from one source and processes them all the same way. A plain handler function is simpler
- **Single-purpose Lambdas** - Your Lambda does exactly one thing. Routing and filtering add indirection with no upside
- **HTTP-only Lambdas** - Dedicated HTTP frameworks like Express, Hono and Fastify have richer ecosystems for middleware, auth and templating
- **Performance-critical Lambdas with simple logic** - The matcher iterates through registered matchers via `canHandleEvent` checks and applies middleware chains. For ultra-simple Lambdas where every millisecond counts, a direct handler avoids this overhead
- **One Lambda per event source** - If you intentionally map one Lambda to one event source for isolated scaling, permissions or deployment, there's nothing to route between
