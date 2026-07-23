type SupportedAWSServices =
  | 'other'
  | 'eventbridge'
  | 'api-gateway'
  | 'elb'
  | 'vpc-lattice'
  | 'sqs'
  | 'sns'
  | 'kinesis'
  | 'firehose'
  | 'msk'
  | 'mq'
  | 'dynamodb'
  | 'documentdb'
  | 's3'
  | 'cloudwatch'
  | 'step-functions'
  | 'codepipeline'
  | 'codecommit'
  | 'cloudformation'
  | 'config'
  | 'cognito'
  | 'appsync'
  | 'ses'
  | 'connect'
  | 'lex'
  | 'secrets-manager';

export type PackageEntry = {
  icons: string[];
  name: string;
  package: string;
  details: string;
  services: SupportedAWSServices[];
  link: string;
};

export type FilterPill = {
  name: string;
  short: string;
  service: string;
  link: string;
};

// Use Record here to ensure there is at least one pill for each service
export const filterPillsMap: Record<SupportedAWSServices, FilterPill> = {
  eventbridge: {
    name: 'Amazon EventBridge',
    short: 'EventBridge',
    service: 'eventbridge',
    link: '/routers/EventBridgeRouter',
  },
  'api-gateway': {
    name: 'Amazon API Gateway',
    short: 'API Gateway',
    service: 'api-gateway',
    link: '/routers/APIGatewayRouter',
  },
  elb: {
    name: 'Elastic Load Balancing',
    short: 'ALB',
    service: 'elb',
    link: '/routers/ALBRouter',
  },
  'vpc-lattice': {
    name: 'Amazon VPC Lattice',
    short: 'VPC Lattice',
    service: 'vpc-lattice',
    link: '/routers/VPCLatticeRouter',
  },
  sqs: {
    name: 'Amazon SQS',
    short: 'SQS',
    service: 'sqs',
    link: '/routers/SQSRouter',
  },
  sns: {
    name: 'Amazon SNS',
    short: 'SNS',
    service: 'sns',
    link: '/routers/SNSRouter',
  },
  kinesis: {
    name: 'Amazon Kinesis',
    short: 'Kinesis',
    service: 'kinesis',
    link: '/routers/KinesisRouter',
  },
  firehose: {
    name: 'Amazon Data Firehose',
    short: 'Firehose',
    service: 'firehose',
    link: '/routers/FirehoseRouter',
  },
  msk: {
    name: 'Amazon MSK / Self-managed Kafka',
    short: 'MSK / Kafka',
    service: 'msk',
    link: '/routers/KafkaRouter',
  },
  mq: {
    name: 'Amazon MQ',
    short: 'Amazon MQ',
    service: 'mq',
    link: '/routers/ActiveMQRouter',
  },
  dynamodb: {
    name: 'Amazon DynamoDB',
    short: 'DynamoDB',
    service: 'dynamodb',
    link: '/routers/DynamoDBRouter',
  },
  documentdb: {
    name: 'Amazon DocumentDB',
    short: 'DocumentDB',
    service: 'documentdb',
    link: '/routers/DocumentDBRouter',
  },
  s3: {
    name: 'Amazon S3',
    short: 'S3',
    service: 's3',
    link: '/routers/S3Router',
  },
  cloudwatch: {
    name: 'Amazon CloudWatch',
    short: 'CloudWatch',
    service: 'cloudwatch',
    link: '/routers/CloudWatchLogsRouter',
  },
  'step-functions': {
    name: 'AWS Step Functions',
    short: 'Step Functions',
    service: 'step-functions',
    link: '/routers/StepFunctionsRouter',
  },
  codepipeline: {
    name: 'AWS CodePipeline',
    short: 'CodePipeline',
    service: 'codepipeline',
    link: '/routers/CodePipelineRouter',
  },
  codecommit: {
    name: 'AWS CodeCommit',
    short: 'CodeCommit',
    service: 'codecommit',
    link: '/routers/CodeCommitRouter',
  },
  cloudformation: {
    name: 'AWS CloudFormation',
    short: 'CloudFormation',
    service: 'cloudformation',
    link: '/routers/CloudFormationRouter',
  },
  config: {
    name: 'AWS Config',
    short: 'Config',
    service: 'config',
    link: '/routers/ConfigRouter',
  },
  cognito: {
    name: 'Amazon Cognito',
    short: 'Cognito',
    service: 'cognito',
    link: '/routers/CognitoRouter',
  },
  appsync: {
    name: 'AWS AppSync',
    short: 'AppSync',
    service: 'appsync',
    link: '/routers/AppSyncRouter',
  },
  ses: {
    name: 'Amazon SES',
    short: 'SES',
    service: 'ses',
    link: '/routers/SESRouter',
  },
  connect: {
    name: 'Amazon Connect',
    short: 'Connect',
    service: 'connect',
    link: '/routers/ConnectRouter',
  },
  lex: {
    name: 'Amazon Lex',
    short: 'Lex',
    service: 'lex',
    link: '/routers/LexRouter',
  },
  'secrets-manager': {
    name: 'AWS Secrets Manager',
    short: 'Secrets Manager',
    service: 'secrets-manager',
    link: '/routers/SecretsManagerRouter',
  },
  other: {
    name: 'All other services',
    short: 'All other services',
    service: 'other',
    link: '/packages',
  },
};
export const filterPills: FilterPill[] = Object.values(filterPillsMap);

export const packages: PackageEntry[] = [
  {
    icons: ['eventbridge', 'step-functions'],
    name: 'EventRouter',
    package: '@lambda-event-router/base',
    services: ['eventbridge'],
    details: 'Amazon EventBridge - Any event sources with a custom envelope. E.g Step Functions',
    link: '/routers/EventRouter',
  },
  {
    icons: ['api-gateway'],
    name: 'APIGatewayRouter',
    package: '@lambda-event-router/apigateway',
    services: ['api-gateway'],
    details: 'Amazon API Gateway - REST API, HTTP API',
    link: '/routers/APIGatewayRouter',
  },
  {
    icons: ['api-gateway'],
    name: 'WebSocketRouter',
    package: '@lambda-event-router/apigateway',
    services: ['api-gateway'],
    details: 'Amazon API Gateway - WebSocket',
    link: '/routers/WebSocketRouter',
  },
  {
    icons: ['api-gateway'],
    name: 'LambdaAuthorizerRouter',
    package: '@lambda-event-router/apigateway',
    services: ['api-gateway'],
    details: 'Amazon API Gateway - Lambda Authorizer',
    link: '/routers/LambdaAuthorizerRouter',
  },
  {
    icons: ['elb'],
    name: 'ALBRouter',
    package: '@lambda-event-router/alb',
    services: ['elb'],
    details: 'Elastic Load Balancing - Application Load Balancer',
    link: '/routers/ALBRouter',
  },
  {
    icons: ['vpc-lattice'],
    name: 'VPCLatticeRouter',
    package: '@lambda-event-router/vpclattice',
    services: ['vpc-lattice'],
    details: 'Amazon VPC Lattice - ',
    link: '/routers/VPCLatticeRouter',
  },
  {
    icons: ['sqs'],
    name: 'SQSRouter',
    package: '@lambda-event-router/sqs',
    services: ['sqs'],
    details: 'Amazon SQS - Queue',
    link: '/routers/SQSRouter',
  },
  {
    icons: ['sns'],
    name: 'SNSRouter',
    package: '@lambda-event-router/sns',
    services: ['sns'],
    details: 'Amazon SNS - Topic notification',
    link: '/routers/SNSRouter',
  },
  {
    icons: ['eventbridge', 'other'],
    name: 'EventBridgeRouter',
    package: '@lambda-event-router/eventbridge',
    services: ['eventbridge', 'other'],
    details: 'Amazon EventBridge - Rule, Pipe, Bus plus any other AWS service via CloudTrail',
    link: '/routers/EventBridgeRouter',
  },
  {
    icons: ['kinesis'],
    name: 'KinesisRouter',
    package: '@lambda-event-router/kinesis',
    services: ['kinesis'],
    details: 'Amazon Kinesis - Data Streams',
    link: '/routers/KinesisRouter',
  },
  {
    icons: ['firehose'],
    name: 'FirehoseRouter',
    package: '@lambda-event-router/firehose',
    services: ['firehose'],
    details: 'Amazon Data Firehose - Transformation',
    link: '/routers/FirehoseRouter',
  },
  {
    icons: ['msk'],
    name: 'KafkaRouter',
    package: '@lambda-event-router/kafka',
    services: ['msk'],
    details: 'Amazon MSK / Self-managed Kafka - ',
    link: '/routers/KafkaRouter',
  },
  {
    icons: ['mq'],
    name: 'ActiveMQRouter',
    package: '@lambda-event-router/mq',
    services: ['mq'],
    details: 'Amazon MQ - ActiveMQ',
    link: '/routers/ActiveMQRouter',
  },
  {
    icons: ['mq'],
    name: 'RabbitMQRouter',
    package: '@lambda-event-router/mq',
    services: ['mq'],
    details: 'Amazon MQ - RabbitMQ',
    link: '/routers/RabbitMQRouter',
  },
  {
    icons: ['dynamodb'],
    name: 'DynamoDBRouter',
    package: '@lambda-event-router/dynamodb',
    services: ['dynamodb'],
    details: 'Amazon DynamoDB - Streams',
    link: '/routers/DynamoDBRouter',
  },
  {
    icons: ['documentdb'],
    name: 'DocumentDBRouter',
    package: '@lambda-event-router/documentdb',
    services: ['documentdb'],
    details: 'Amazon DocumentDB - Change Streams',
    link: '/routers/DocumentDBRouter',
  },
  {
    icons: ['s3'],
    name: 'S3Router',
    package: '@lambda-event-router/s3',
    services: ['s3'],
    details: 'Amazon S3 - Object notification, Batch Operations',
    link: '/routers/S3Router',
  },
  {
    icons: ['cloudwatch'],
    name: 'CloudWatchLogsRouter',
    package: '@lambda-event-router/cloudwatch',
    services: ['cloudwatch'],
    details: 'Amazon CloudWatch - Logs subscription filter',
    link: '/routers/CloudWatchLogsRouter',
  },
  {
    icons: ['step-functions'],
    name: 'StepFunctionsRouter',
    package: '@lambda-event-router/stepfunctions',
    services: ['step-functions'],
    details: 'AWS Step Functions - Task',
    link: '/routers/StepFunctionsRouter',
  },
  {
    icons: ['codepipeline'],
    name: 'CodePipelineRouter',
    package: '@lambda-event-router/codepipeline',
    services: ['codepipeline'],
    details: 'AWS CodePipeline - Job',
    link: '/routers/CodePipelineRouter',
  },
  {
    icons: ['codecommit'],
    name: 'CodeCommitRouter',
    package: '@lambda-event-router/codecommit',
    services: ['codecommit'],
    details: 'AWS CodeCommit - Repository trigger',
    link: '/routers/CodeCommitRouter',
  },
  {
    icons: ['cloudformation'],
    name: 'CloudFormationRouter',
    package: '@lambda-event-router/cloudformation',
    services: ['cloudformation'],
    details: 'AWS CloudFormation - Custom Resource',
    link: '/routers/CloudFormationRouter',
  },
  {
    icons: ['config'],
    name: 'ConfigRouter',
    package: '@lambda-event-router/config',
    services: ['config'],
    details: 'AWS Config - Custom Rule',
    link: '/routers/ConfigRouter',
  },
  {
    icons: ['config'],
    name: 'ConfigScheduledRouter',
    package: '@lambda-event-router/config',
    services: ['config'],
    details: 'AWS Config - Scheduled Rule',
    link: '/routers/ConfigScheduledRouter',
  },
  {
    icons: ['cognito'],
    name: 'CognitoRouter',
    package: '@lambda-event-router/cognito',
    services: ['cognito'],
    details: 'Amazon Cognito - User Pool triggers',
    link: '/routers/CognitoRouter',
  },
  {
    icons: ['appsync'],
    name: 'AppSyncRouter',
    package: '@lambda-event-router/appsync',
    services: ['appsync'],
    details: 'AWS AppSync - Resolver',
    link: '/routers/AppSyncRouter',
  },
  {
    icons: ['appsync'],
    name: 'AppSyncAuthorizerRouter',
    package: '@lambda-event-router/appsync',
    services: ['appsync'],
    details: 'AWS AppSync - Authorizer',
    link: '/routers/AppSyncAuthorizerRouter',
  },
  {
    icons: ['appsync'],
    name: 'AppSyncEventsAuthorizerRouter',
    package: '@lambda-event-router/appsync',
    services: ['appsync'],
    details: 'AWS AppSync - Event API authorizer',
    link: '/routers/AppSyncEventsAuthorizerRouter',
  },
  {
    icons: ['appsync'],
    name: 'AppSyncEventsRouter',
    package: '@lambda-event-router/appsync',
    services: ['appsync'],
    details: 'AWS AppSync - Events',
    link: '/routers/AppSyncEventsRouter',
  },
  {
    icons: ['ses'],
    name: 'SESRouter',
    package: '@lambda-event-router/ses',
    services: ['ses'],
    details: 'Amazon SES - Email receipt',
    link: '/routers/SESRouter',
  },
  {
    icons: ['connect'],
    name: 'ConnectRouter',
    package: '@lambda-event-router/connect',
    services: ['connect'],
    details: 'Amazon Connect - Contact flow',
    link: '/routers/ConnectRouter',
  },
  {
    icons: ['lex'],
    name: 'LexRouter',
    package: '@lambda-event-router/lex',
    services: ['lex'],
    details: 'Amazon Lex - Bot (v2)',
    link: '/routers/LexRouter',
  },
  {
    icons: ['secrets-manager'],
    name: 'SecretsManagerRouter',
    package: '@lambda-event-router/secretsmanager',
    services: ['secrets-manager'],
    details: 'AWS Secrets Manager - Rotation',
    link: '/routers/SecretsManagerRouter',
  },
];
