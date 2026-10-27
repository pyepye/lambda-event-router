import { withBase } from 'vitepress';

export function iconUrl(slug: string): string {
  return withBase(`/aws-icons/${slug}.svg`);
}

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
    link: '/matchers/EventBridgeMatcher',
  },
  'api-gateway': {
    name: 'Amazon API Gateway',
    short: 'API Gateway',
    service: 'api-gateway',
    link: '/matchers/APIGatewayMatcher',
  },
  elb: {
    name: 'Elastic Load Balancing',
    short: 'ALB',
    service: 'elb',
    link: '/matchers/ALBMatcher',
  },
  'vpc-lattice': {
    name: 'Amazon VPC Lattice',
    short: 'VPC Lattice',
    service: 'vpc-lattice',
    link: '/matchers/VPCLatticeMatcher',
  },
  sqs: {
    name: 'Amazon SQS',
    short: 'SQS',
    service: 'sqs',
    link: '/matchers/SQSMatcher',
  },
  sns: {
    name: 'Amazon SNS',
    short: 'SNS',
    service: 'sns',
    link: '/matchers/SNSMatcher',
  },
  kinesis: {
    name: 'Amazon Kinesis',
    short: 'Kinesis',
    service: 'kinesis',
    link: '/matchers/KinesisMatcher',
  },
  firehose: {
    name: 'Amazon Data Firehose',
    short: 'Firehose',
    service: 'firehose',
    link: '/matchers/FirehoseMatcher',
  },
  msk: {
    name: 'Amazon MSK / Self-managed Kafka',
    short: 'MSK / Kafka',
    service: 'msk',
    link: '/matchers/KafkaMatcher',
  },
  mq: {
    name: 'Amazon MQ',
    short: 'Amazon MQ',
    service: 'mq',
    link: '/matchers/ActiveMQMatcher',
  },
  dynamodb: {
    name: 'Amazon DynamoDB',
    short: 'DynamoDB',
    service: 'dynamodb',
    link: '/matchers/DynamoDBMatcher',
  },
  documentdb: {
    name: 'Amazon DocumentDB',
    short: 'DocumentDB',
    service: 'documentdb',
    link: '/matchers/DocumentDBMatcher',
  },
  s3: {
    name: 'Amazon S3',
    short: 'S3',
    service: 's3',
    link: '/matchers/S3Matcher',
  },
  cloudwatch: {
    name: 'Amazon CloudWatch',
    short: 'CloudWatch',
    service: 'cloudwatch',
    link: '/matchers/CloudWatchLogsMatcher',
  },
  'step-functions': {
    name: 'AWS Step Functions',
    short: 'Step Functions',
    service: 'step-functions',
    link: '/matchers/StepFunctionsMatcher',
  },
  codepipeline: {
    name: 'AWS CodePipeline',
    short: 'CodePipeline',
    service: 'codepipeline',
    link: '/matchers/CodePipelineMatcher',
  },
  codecommit: {
    name: 'AWS CodeCommit',
    short: 'CodeCommit',
    service: 'codecommit',
    link: '/matchers/CodeCommitMatcher',
  },
  cloudformation: {
    name: 'AWS CloudFormation',
    short: 'CloudFormation',
    service: 'cloudformation',
    link: '/matchers/CloudFormationMatcher',
  },
  config: {
    name: 'AWS Config',
    short: 'Config',
    service: 'config',
    link: '/matchers/ConfigMatcher',
  },
  cognito: {
    name: 'Amazon Cognito',
    short: 'Cognito',
    service: 'cognito',
    link: '/matchers/CognitoMatcher',
  },
  appsync: {
    name: 'AWS AppSync',
    short: 'AppSync',
    service: 'appsync',
    link: '/matchers/AppSyncMatcher',
  },
  ses: {
    name: 'Amazon SES',
    short: 'SES',
    service: 'ses',
    link: '/matchers/SESMatcher',
  },
  connect: {
    name: 'Amazon Connect',
    short: 'Connect',
    service: 'connect',
    link: '/matchers/ConnectMatcher',
  },
  lex: {
    name: 'Amazon Lex',
    short: 'Lex',
    service: 'lex',
    link: '/matchers/LexMatcher',
  },
  'secrets-manager': {
    name: 'AWS Secrets Manager',
    short: 'Secrets Manager',
    service: 'secrets-manager',
    link: '/matchers/SecretsManagerMatcher',
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
    name: 'EventMatcher',
    package: '@latcher/base',
    services: ['eventbridge'],
    details: 'Amazon EventBridge - Any event sources with a custom envelope. E.g Step Functions',
    link: '/matchers/EventMatcher',
  },
  {
    icons: ['api-gateway'],
    name: 'APIGatewayMatcher',
    package: '@latcher/apigateway',
    services: ['api-gateway'],
    details: 'Amazon API Gateway - REST API, HTTP API',
    link: '/matchers/APIGatewayMatcher',
  },
  {
    icons: ['api-gateway'],
    name: 'WebSocketMatcher',
    package: '@latcher/apigateway',
    services: ['api-gateway'],
    details: 'Amazon API Gateway - WebSocket',
    link: '/matchers/WebSocketMatcher',
  },
  {
    icons: ['api-gateway'],
    name: 'LambdaAuthorizerMatcher',
    package: '@latcher/apigateway',
    services: ['api-gateway'],
    details: 'Amazon API Gateway - Lambda Authorizer',
    link: '/matchers/LambdaAuthorizerMatcher',
  },
  {
    icons: ['elb'],
    name: 'ALBMatcher',
    package: '@latcher/alb',
    services: ['elb'],
    details: 'Elastic Load Balancing - Application Load Balancer',
    link: '/matchers/ALBMatcher',
  },
  {
    icons: ['vpc-lattice'],
    name: 'VPCLatticeMatcher',
    package: '@latcher/vpclattice',
    services: ['vpc-lattice'],
    details: 'Amazon VPC Lattice - ',
    link: '/matchers/VPCLatticeMatcher',
  },
  {
    icons: ['sqs'],
    name: 'SQSMatcher',
    package: '@latcher/sqs',
    services: ['sqs'],
    details: 'Amazon SQS - Queue',
    link: '/matchers/SQSMatcher',
  },
  {
    icons: ['sns'],
    name: 'SNSMatcher',
    package: '@latcher/sns',
    services: ['sns'],
    details: 'Amazon SNS - Topic notification',
    link: '/matchers/SNSMatcher',
  },
  {
    icons: ['eventbridge', 'other'],
    name: 'EventBridgeMatcher',
    package: '@latcher/eventbridge',
    services: ['eventbridge', 'other'],
    details: 'Amazon EventBridge - Rule, Pipe, Bus plus any other AWS service via CloudTrail',
    link: '/matchers/EventBridgeMatcher',
  },
  {
    icons: ['kinesis'],
    name: 'KinesisMatcher',
    package: '@latcher/kinesis',
    services: ['kinesis'],
    details: 'Amazon Kinesis - Data Streams',
    link: '/matchers/KinesisMatcher',
  },
  {
    icons: ['firehose'],
    name: 'FirehoseMatcher',
    package: '@latcher/firehose',
    services: ['firehose'],
    details: 'Amazon Data Firehose - Transformation',
    link: '/matchers/FirehoseMatcher',
  },
  {
    icons: ['msk'],
    name: 'KafkaMatcher',
    package: '@latcher/kafka',
    services: ['msk'],
    details: 'Amazon MSK / Self-managed Kafka - ',
    link: '/matchers/KafkaMatcher',
  },
  {
    icons: ['mq'],
    name: 'ActiveMQMatcher',
    package: '@latcher/mq',
    services: ['mq'],
    details: 'Amazon MQ - ActiveMQ',
    link: '/matchers/ActiveMQMatcher',
  },
  {
    icons: ['mq'],
    name: 'RabbitMQMatcher',
    package: '@latcher/mq',
    services: ['mq'],
    details: 'Amazon MQ - RabbitMQ',
    link: '/matchers/RabbitMQMatcher',
  },
  {
    icons: ['dynamodb'],
    name: 'DynamoDBMatcher',
    package: '@latcher/dynamodb',
    services: ['dynamodb'],
    details: 'Amazon DynamoDB - Streams',
    link: '/matchers/DynamoDBMatcher',
  },
  {
    icons: ['documentdb'],
    name: 'DocumentDBMatcher',
    package: '@latcher/documentdb',
    services: ['documentdb'],
    details: 'Amazon DocumentDB - Change Streams',
    link: '/matchers/DocumentDBMatcher',
  },
  {
    icons: ['s3'],
    name: 'S3Matcher',
    package: '@latcher/s3',
    services: ['s3'],
    details: 'Amazon S3 - Object notification',
    link: '/matchers/S3Matcher',
  },
  {
    icons: ['s3'],
    name: 'S3BatchMatcher',
    package: '@latcher/s3',
    services: ['s3'],
    details: 'Amazon S3 - Batch Operations',
    link: '/matchers/S3BatchMatcher',
  },
  {
    icons: ['cloudwatch'],
    name: 'CloudWatchLogsMatcher',
    package: '@latcher/cloudwatch',
    services: ['cloudwatch'],
    details: 'Amazon CloudWatch - Logs subscription filter',
    link: '/matchers/CloudWatchLogsMatcher',
  },
  {
    icons: ['step-functions'],
    name: 'StepFunctionsMatcher',
    package: '@latcher/stepfunctions',
    services: ['step-functions'],
    details: 'AWS Step Functions - Task',
    link: '/matchers/StepFunctionsMatcher',
  },
  {
    icons: ['codepipeline'],
    name: 'CodePipelineMatcher',
    package: '@latcher/codepipeline',
    services: ['codepipeline'],
    details: 'AWS CodePipeline - Job',
    link: '/matchers/CodePipelineMatcher',
  },
  {
    icons: ['codecommit'],
    name: 'CodeCommitMatcher',
    package: '@latcher/codecommit',
    services: ['codecommit'],
    details: 'AWS CodeCommit - Repository trigger',
    link: '/matchers/CodeCommitMatcher',
  },
  {
    icons: ['cloudformation'],
    name: 'CloudFormationMatcher',
    package: '@latcher/cloudformation',
    services: ['cloudformation'],
    details: 'AWS CloudFormation - Custom Resource',
    link: '/matchers/CloudFormationMatcher',
  },
  {
    icons: ['config'],
    name: 'ConfigMatcher',
    package: '@latcher/config',
    services: ['config'],
    details: 'AWS Config - Custom Rule',
    link: '/matchers/ConfigMatcher',
  },
  {
    icons: ['config'],
    name: 'ConfigScheduledMatcher',
    package: '@latcher/config',
    services: ['config'],
    details: 'AWS Config - Scheduled Rule',
    link: '/matchers/ConfigScheduledMatcher',
  },
  {
    icons: ['cognito'],
    name: 'CognitoMatcher',
    package: '@latcher/cognito',
    services: ['cognito'],
    details: 'Amazon Cognito - User Pool triggers',
    link: '/matchers/CognitoMatcher',
  },
  {
    icons: ['appsync'],
    name: 'AppSyncMatcher',
    package: '@latcher/appsync',
    services: ['appsync'],
    details: 'AWS AppSync - Resolver',
    link: '/matchers/AppSyncMatcher',
  },
  {
    icons: ['appsync'],
    name: 'AppSyncAuthorizerMatcher',
    package: '@latcher/appsync',
    services: ['appsync'],
    details: 'AWS AppSync - Authorizer',
    link: '/matchers/AppSyncAuthorizerMatcher',
  },
  {
    icons: ['appsync'],
    name: 'AppSyncEventsAuthorizerMatcher',
    package: '@latcher/appsync',
    services: ['appsync'],
    details: 'AWS AppSync - Event API authorizer',
    link: '/matchers/AppSyncEventsAuthorizerMatcher',
  },
  {
    icons: ['appsync'],
    name: 'AppSyncEventsMatcher',
    package: '@latcher/appsync',
    services: ['appsync'],
    details: 'AWS AppSync - Events',
    link: '/matchers/AppSyncEventsMatcher',
  },
  {
    icons: ['ses'],
    name: 'SESMatcher',
    package: '@latcher/ses',
    services: ['ses'],
    details: 'Amazon SES - Email receipt',
    link: '/matchers/SESMatcher',
  },
  {
    icons: ['connect'],
    name: 'ConnectMatcher',
    package: '@latcher/connect',
    services: ['connect'],
    details: 'Amazon Connect - Contact flow',
    link: '/matchers/ConnectMatcher',
  },
  {
    icons: ['lex'],
    name: 'LexMatcher',
    package: '@latcher/lex',
    services: ['lex'],
    details: 'Amazon Lex - Bot (v2)',
    link: '/matchers/LexMatcher',
  },
  {
    icons: ['secrets-manager'],
    name: 'SecretsManagerMatcher',
    package: '@latcher/secretsmanager',
    services: ['secrets-manager'],
    details: 'AWS Secrets Manager - Rotation',
    link: '/matchers/SecretsManagerMatcher',
  },
];
