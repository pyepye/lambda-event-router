<p align="center">
    <img src="./docs/public/lambda-event-router.svg" width="200px" align="center" alt="Lambda Event Router logo" />
  <h1 align="center">Lambda Event Router</h1>
</p>

A TypeScript framework for routing AWS Lambda events. You define routers for the AWS services you care about - SQS, API Gateway, DynamoDB Streams, S3 and more - and the framework works out which router should handle each event.

This is useful when you want a single Lambda (or a set of Lambdas with shared code) to handle events from multiple sources. Instead of writing your own event detection logic, you declare filters and handlers and let the router do the matching.

<br />


```ts
import { LambdaRouter } from '@lambda-event-router/base'
import { apiGatewayRouter } from './api'
import { sqsRouter } from './sqs'
import { dynamoDBRouter } from './dynamo'
import { s3Router } from './s3'

const lambdaRouter = new LambdaRouter({
  routers: [apiGatewayRouter, sqsRouter, dynamoDBRouter, s3Router]
})

export const handler = lambdaRouter.handler()
```


## Features

- **Multi-source routing** - Combine routers from different AWS services in a single Lambda handler
- **Type-safe** - Full TypeScript support with inferred types from schemas and filters for inline handlers
- **Declarative filters** - Route events by service-specific data - ARN, eventType, topic, bucket, event name, detail type and custom filter functions
- **Native support for 29+ AWS services** - Includes dedicated routers for SQS, SNS, EventBridge, DynamoDB Streams, S3, API Gateway, and more. Any service that emits Lambda events is supported out of the box.
- **Works with any AWS service** - Even services without native Lambda support can be integrated using CloudTrail and EventBridge using the EventBridgeRouter.
- **Schema validation** - Built-in validation for request bodies, message attributes, path params and more. Works with any Standard Schema library
- **Well tested** - Clear tests covering most code branches for each event type

This framework isn't the right fit in every situation. See [When not to use it](#when-not-to-use-it) for more details.


## Packages / Supported AWS services

Below is an overview of the packages and routers included. Each package can be installed individually.

For usage details, check the individual READMEs linked in the table.

| Service | Feature / Event Source | Package | Router | Link |
|---------|----------------------|---------|--------|------|
| Amazon API Gateway | REST API | [`@lambda-event-router/apigateway`](packages/apigateway/README.md) | `APIGatewayRouter` | [README](packages/apigateway/README.md) |
| Amazon API Gateway | HTTP API | [`@lambda-event-router/apigateway`](packages/apigateway/README.md) | `APIGatewayRouter` | [README](packages/apigateway/README.md) |
| Amazon API Gateway | WebSocket | [`@lambda-event-router/apigateway`](packages/apigateway/README.md) | `WebSocketRouter` | [README](packages/apigateway/README.md) |
| Amazon API Gateway | Lambda Authorizer | [`@lambda-event-router/apigateway`](packages/apigateway/README.md) | `LambdaAuthorizerRouter` | [README](packages/apigateway/README.md) |
| Elastic Load Balancing | Application Load Balancer | [`@lambda-event-router/alb`](packages/alb/README.md) | `ALBRouter` | [README](packages/alb/README.md) |
| Amazon VPC Lattice | VPC Lattice | [`@lambda-event-router/vpclattice`](packages/vpclattice/README.md) | `VPCLatticeRouter` | [README](packages/vpclattice/README.md) |
| Amazon SQS | Queue | [`@lambda-event-router/sqs`](packages/sqs/README.md) | `SQSRouter` | [README](packages/sqs/README.md) |
| Amazon SNS | Topic notification | [`@lambda-event-router/sns`](packages/sns/README.md) | `SNSRouter` | [README](packages/sns/README.md) |
| Amazon DynamoDB | Streams | [`@lambda-event-router/dynamodb`](packages/dynamodb/README.md) | `DynamoDBRouter` | [README](packages/dynamodb/README.md) |
| Amazon Kinesis | Data Streams | [`@lambda-event-router/kinesis`](packages/kinesis/README.md) | `KinesisRouter` | [README](packages/kinesis/README.md) |
| Amazon Data Firehose | Transformation | [`@lambda-event-router/firehose`](packages/firehose/README.md) | `FirehoseRouter` | [README](packages/firehose/README.md) |
| Amazon MSK / Self-managed | Kafka | [`@lambda-event-router/kafka`](packages/kafka/README.md) | `KafkaRouter` | [README](packages/kafka/README.md) |
| Amazon MQ | ActiveMQ | [`@lambda-event-router/mq`](packages/mq/README.md) | `ActiveMQRouter` | [README](packages/mq/README.md) |
| Amazon MQ | RabbitMQ | [`@lambda-event-router/mq`](packages/mq/README.md) | `RabbitMQRouter` | [README](packages/mq/README.md) |
| Amazon DocumentDB | Change Streams | [`@lambda-event-router/documentdb`](packages/documentdb/README.md) | `DocumentDBRouter` | [README](packages/documentdb/README.md) |
| Amazon EventBridge | Rule | [`@lambda-event-router/eventbridge`](packages/eventbridge/README.md) | `EventBridgeRouter` | [README](packages/eventbridge/README.md) |
| Amazon EventBridge | Pipe | [`@lambda-event-router/eventbridge`](packages/eventbridge/README.md) | `EventBridgeRouter` | [README](packages/eventbridge/README.md) |
| Amazon EventBridge | Bus | [`@lambda-event-router/eventbridge`](packages/eventbridge/README.md) | `EventBridgeRouter` | [README](packages/eventbridge/README.md) |
| Amazon EventBridge | Scheduler | [`@lambda-event-router/base`](packages/base/README.md) | `EventRouter` | [README](packages/base/README.md) |
| Amazon S3 | Object notification | [`@lambda-event-router/s3`](packages/s3/README.md) | `S3Router` | [README](packages/s3/README.md) |
| Amazon S3 | Batch Operations | [`@lambda-event-router/s3`](packages/s3/README.md) | `S3Router` | [README](packages/s3/README.md) |
| Amazon CloudWatch | Logs subscription filter | [`@lambda-event-router/cloudwatch`](packages/cloudwatch/README.md) | `CloudWatchLogsRouter` | [README](packages/cloudwatch/README.md) |
| AWS Step Functions | Task | [`@lambda-event-router/stepfunctions`](packages/stepfunctions/README.md) | `StepFunctionsRouter` | [README](packages/stepfunctions/README.md) |
| AWS CodePipeline | Job | [`@lambda-event-router/codepipeline`](packages/codepipeline/README.md) | `CodePipelineRouter` | [README](packages/codepipeline/README.md) |
| Amazon Cognito | User Pool triggers | [`@lambda-event-router/cognito`](packages/cognito/README.md) | `CognitoRouter` | [README](packages/cognito/README.md) |
| AWS AppSync | Resolver | [`@lambda-event-router/appsync`](packages/appsync/README.md) | `AppSyncRouter` | [README](packages/appsync/README.md) |
| AWS AppSync | Authorizer | [`@lambda-event-router/appsync`](packages/appsync/README.md) | `AppSyncAuthorizerRouter` | [README](packages/appsync/README.md) |
| AWS AppSync | Events | [`@lambda-event-router/appsync`](packages/appsync/README.md) | `AppSyncEventsRouter` | [README](packages/appsync/README.md) |
| Amazon SES | Email receipt | [`@lambda-event-router/ses`](packages/ses/README.md) | `SESRouter` | [README](packages/ses/README.md) |
| Amazon Connect | Contact flow | [`@lambda-event-router/connect`](packages/connect/README.md) | `ConnectRouter` | [README](packages/connect/README.md) |
| Amazon Lex | Bot (v2) | [`@lambda-event-router/lex`](packages/lex/README.md) | `LexRouter` | [README](packages/lex/README.md) |
| AWS Secrets Manager | Rotation | [`@lambda-event-router/secretsmanager`](packages/secretsmanager/README.md) | `SecretsManagerRouter` | [README](packages/secretsmanager/README.md) |
| AWS Config | Custom Rule | [`@lambda-event-router/config`](packages/config/README.md) | `ConfigRouter` | [README](packages/config/README.md) |
| AWS Config | Scheduled Rule | [`@lambda-event-router/config`](packages/config/README.md) | `ConfigScheduledRouter` | [README](packages/config/README.md) |
| AWS CodeCommit | Repository trigger | [`@lambda-event-router/codecommit`](packages/codecommit/README.md) | `CodeCommitRouter` | [README](packages/codecommit/README.md) |
| AWS CloudFormation | Custom Resource | [`@lambda-event-router/cloudformation`](packages/cloudformation/README.md) | `CloudFormationRouter` | [README](packages/cloudformation/README.md) |
| AWS IoT Core | Rules Engine action | [`@lambda-event-router/iot`](packages/iot/README.md) | `IoTRouter` | [README](packages/iot/README.md) |


## Quick start

Install the base package and the service router you need:

```bash
npm install @lambda-event-router/[package]
```

For example, to install routers for apigateway and sqs

```bash
npm install @lambda-event-router/apigateway @lambda-event-router/sqs
```


## Basic usage

Here's a quick look at how you define handlers. For the full details on each router, check their individual READMEs.

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { apiRouter } from './api'
import { sqsRouter } from './sqs'

const lambdaRouter = new LambdaRouter({
  routers: [apiRouter, sqsRouter]
})

export const handler = lambdaRouter.handler()
```

```ts
// api.ts
import { createAPIGatewayRouter } from '@lambda-event-router/apigateway'

const apiRouter = createAPIGatewayRouter()

apiRouter.route({
  filter {
    method: 'POST'
    path: '/order/:id/'
  },
  handler: createOrder // Puts message on an SQS queue with a message attribute of ProcessOrder (string)
})
```

```ts
// sqs.ts
import { createSQSRouter } from '@lambda-event-router/sqs'
import { processOrder } from './order/process'
import { refundOrder } from './order/refund'

const sqsRouter = createSQSRouter()

sqsRouter.route({
  filter: {
    messageAttributes: {
      Type: ['ProcessOrder'],
    }
  },
  handler: processOrder
})

sqsRouter.route({
  filter: {
    messageAttributes: {
      Type: ['RefundOrder'],
    }
  },
  handler: refundOrder
})
```


## Examples

See the [examples](examples/) directory for working examples covering every supported service.

There is also a [full-examples](full-examples/) directory with deployable code you can spin up on your own AWS environment with a few commands.


## When not to use it

If your Lambda handles a single event source in a single way, you probably don't need this. Here are some cases where it isn't the right fit:

- **Single event source with no filtering** - Your Lambda receives events from one source and processes them all the same way. A plain handler function is simpler
- **Single-purpose Lambdas** - Your Lambda does exactly one thing. Routing and filtering add indirection with no upside
- **HTTP-only Lambdas** - Dedicated HTTP frameworks like Express, Hono and Fastify have richer ecosystems for middleware, auth and templating
- **Performance-critical Lambdas with simple logic** - The router iterates through registered routers via `canHandleEvent` checks and applies middleware chains. For ultra-simple Lambdas where every millisecond counts, a direct handler avoids this overhead
- **One Lambda per event source** - If you intentionally map one Lambda to one event source for isolated scaling, permissions or deployment, there's nothing to route between
