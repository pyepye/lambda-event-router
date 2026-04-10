---
sidebar: false
aside: false
prev: false
next: false
---

# Packages

Each package ships a router for a specific AWS event source. Install only the ones you need, every package can be used on its own alongside the `LambdaRouter` from `@lambda-event-router/base`.

| Service | Feature / Event Source | Package | Router |
|---------|------------------------|---------|--------|
| Amazon API Gateway | REST API | `@lambda-event-router/apigateway` | [`APIGatewayRouter`](/routers/APIGatewayRouter) |
| Amazon API Gateway | HTTP API | `@lambda-event-router/apigateway` | [`APIGatewayRouter`](/routers/APIGatewayRouter) |
| Amazon API Gateway | WebSocket | `@lambda-event-router/apigateway` | [`WebSocketRouter`](/routers/WebSocketRouter) |
| Amazon API Gateway | Lambda Authorizer | `@lambda-event-router/apigateway` | [`LambdaAuthorizerRouter`](/routers/LambdaAuthorizerRouter) |
| Elastic Load Balancing | Application Load Balancer | `@lambda-event-router/alb` | [`ALBRouter`](/routers/ALBRouter) |
| Amazon VPC Lattice | VPC Lattice | `@lambda-event-router/vpclattice` | [`VPCLatticeRouter`](/routers/VPCLatticeRouter) |
| Amazon SQS | Queue | `@lambda-event-router/sqs` | [`SQSRouter`](/routers/SQSRouter) |
| Amazon SNS | Topic notification | `@lambda-event-router/sns` | [`SNSRouter`](/routers/SNSRouter) |
| Amazon DynamoDB | Streams | `@lambda-event-router/dynamodb` | [`DynamoDBRouter`](/routers/DynamoDBRouter) |
| Amazon Kinesis | Data Streams | `@lambda-event-router/kinesis` | [`KinesisRouter`](/routers/KinesisRouter) |
| Amazon Data Firehose | Transformation | `@lambda-event-router/firehose` | [`FirehoseRouter`](/routers/FirehoseRouter) |
| Amazon MSK / Self-managed | Kafka | `@lambda-event-router/kafka` | [`KafkaRouter`](/routers/KafkaRouter) |
| Amazon MQ | ActiveMQ | `@lambda-event-router/mq` | [`ActiveMQRouter`](/routers/ActiveMQRouter) |
| Amazon MQ | RabbitMQ | `@lambda-event-router/mq` | [`RabbitMQRouter`](/routers/RabbitMQRouter) |
| Amazon DocumentDB | Change Streams | `@lambda-event-router/documentdb` | [`DocumentDBRouter`](/routers/DocumentDBRouter) |
| Amazon EventBridge | Rule | `@lambda-event-router/eventbridge` | [`EventBridgeRouter`](/routers/EventBridgeRouter) |
| Amazon EventBridge | Pipe | `@lambda-event-router/eventbridge` | [`EventBridgeRouter`](/routers/EventBridgeRouter) |
| Amazon EventBridge | Bus | `@lambda-event-router/eventbridge` | [`EventBridgeRouter`](/routers/EventBridgeRouter) |
| Amazon EventBridge | Scheduler | `@lambda-event-router/base` | [`EventRouter`](/routers/EventRouter) |
| Amazon S3 | Object notification | `@lambda-event-router/s3` | [`S3Router`](/routers/S3Router) |
| Amazon S3 | Batch Operations | `@lambda-event-router/s3` | [`S3Router`](/routers/S3Router) |
| Amazon CloudWatch | Logs subscription filter | `@lambda-event-router/cloudwatch` | [`CloudWatchLogsRouter`](/routers/CloudWatchLogsRouter) |
| AWS Step Functions | Task | `@lambda-event-router/stepfunctions` | [`StepFunctionsRouter`](/routers/StepFunctionsRouter) |
| AWS CodePipeline | Job | `@lambda-event-router/codepipeline` | [`CodePipelineRouter`](/routers/CodePipelineRouter) |
| Amazon Cognito | User Pool triggers | `@lambda-event-router/cognito` | [`CognitoRouter`](/routers/CognitoRouter) |
| AWS AppSync | Resolver | `@lambda-event-router/appsync` | [`AppSyncRouter`](/routers/AppSyncRouter) |
| AWS AppSync | Authorizer | `@lambda-event-router/appsync` | [`AppSyncAuthorizerRouter`](/routers/AppSyncAuthorizerRouter) |
| AWS AppSync | Events | `@lambda-event-router/appsync` | [`AppSyncEventsRouter`](/routers/AppSyncEventsRouter) |
| Amazon SES | Email receipt | `@lambda-event-router/ses` | [`SESRouter`](/routers/SESRouter) |
| Amazon Connect | Contact flow | `@lambda-event-router/connect` | [`ConnectRouter`](/routers/ConnectRouter) |
| Amazon Lex | Bot (v2) | `@lambda-event-router/lex` | [`LexRouter`](/routers/LexRouter) |
| AWS Secrets Manager | Rotation | `@lambda-event-router/secretsmanager` | [`SecretsManagerRouter`](/routers/SecretsManagerRouter) |
| AWS Config | Custom Rule | `@lambda-event-router/config` | [`ConfigRouter`](/routers/ConfigRouter) |
| AWS Config | Scheduled Rule | `@lambda-event-router/config` | [`ConfigScheduledRouter`](/routers/ConfigScheduledRouter) |
| AWS CodeCommit | Repository trigger | `@lambda-event-router/codecommit` | [`CodeCommitRouter`](/routers/CodeCommitRouter) |
| AWS CloudFormation | Custom Resource | `@lambda-event-router/cloudformation` | [`CloudFormationRouter`](/routers/CloudFormationRouter) |
| AWS IoT Core | Rules Engine action | `@lambda-event-router/iot` | [`IoTRouter`](/routers/IoTRouter) |
