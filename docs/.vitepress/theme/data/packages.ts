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
  | 'secrets-manager'
  | 'iot-core';

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
  service: string;
};

// Use Record here to ensure there is at least one pill for each service
export const filterPillsMap: Record<SupportedAWSServices, FilterPill> = {
  eventbridge: { name: 'Amazon EventBridge', service: 'eventbridge' },
  'api-gateway': { name: 'Amazon API Gateway', service: 'api-gateway' },
  elb: { name: 'Elastic Load Balancing', service: 'elb' },
  'vpc-lattice': { name: 'Amazon VPC Lattice', service: 'vpc-lattice' },
  sqs: { name: 'Amazon SQS', service: 'sqs' },
  sns: { name: 'Amazon SNS', service: 'sns' },
  kinesis: { name: 'Amazon Kinesis', service: 'kinesis' },
  firehose: { name: 'Amazon Data Firehose', service: 'firehose' },
  msk: { name: 'Amazon MSK / Self-managed Kafka', service: 'msk' },
  mq: { name: 'Amazon MQ', service: 'mq' },
  dynamodb: { name: 'Amazon DynamoDB', service: 'dynamodb' },
  documentdb: { name: 'Amazon DocumentDB', service: 'documentdb' },
  s3: { name: 'Amazon S3', service: 's3' },
  cloudwatch: { name: 'Amazon CloudWatch', service: 'cloudwatch' },
  'step-functions': { name: 'AWS Step Functions', service: 'step-functions' },
  codepipeline: { name: 'AWS CodePipeline', service: 'codepipeline' },
  codecommit: { name: 'AWS CodeCommit', service: 'codecommit' },
  cloudformation: { name: 'AWS CloudFormation', service: 'cloudformation' },
  config: { name: 'AWS Config', service: 'config' },
  cognito: { name: 'Amazon Cognito', service: 'cognito' },
  appsync: { name: 'AWS AppSync', service: 'appsync' },
  ses: { name: 'Amazon SES', service: 'ses' },
  connect: { name: 'Amazon Connect', service: 'connect' },
  lex: { name: 'Amazon Lex', service: 'lex' },
  'secrets-manager': { name: 'AWS Secrets Manager', service: 'secrets-manager' },
  'iot-core': { name: 'AWS IoT Core', service: 'iot-core' },
  other: { name: 'All other services', service: 'other' },
};
export const filterPills: FilterPill[] = Object.values(filterPillsMap);

export const packages: PackageEntry[] = [
  {
    icons: ['eventbridge', 'step-functions', 'iot-core'],
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
  {
    icons: ['iot-core'],
    name: 'IoTRouter',
    package: '@lambda-event-router/iot',
    services: ['iot-core'],
    details: 'AWS IoT Core - Rules Engine action',
    link: '/routers/IoTRouter',
  },
];
