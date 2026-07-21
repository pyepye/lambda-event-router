export type ExampleEntry = {
  name: string;
  icons: string[];
  summary: string;
  routers: string[];
  path: string;
};

const repository = 'https://github.com/pyepye/lambda-event-router/tree/main';

export function exampleLink(entry: ExampleEntry): string {
  return `${repository}/${entry.path}`;
}

export const serviceExamples: ExampleEntry[] = [
  {
    name: 'ALB',
    icons: ['elb'],
    summary: 'A returns desk behind an Application Load Balancer',
    routers: ['ALBRouter'],
    path: 'service-examples/alb',
  },
  {
    name: 'API Gateway',
    icons: ['api-gateway'],
    summary: 'A warehouse service across a REST API, an HTTP API and a WebSocket API',
    routers: ['APIGatewayRouter', 'LambdaAuthorizerRouter', 'WebSocketRouter'],
    path: 'service-examples/apigateway',
  },
  {
    name: 'AppSync',
    icons: ['appsync'],
    summary: 'A support desk with a GraphQL API, an Event API and one authorizer',
    routers: [
      'AppSyncRouter',
      'AppSyncAuthorizerRouter',
      'AppSyncEventsRouter',
      'AppSyncEventsAuthorizerRouter',
    ],
    path: 'service-examples/appsync',
  },
  {
    name: 'CloudWatch Logs',
    icons: ['cloudwatch'],
    summary: 'Log triage across five subscribed log groups',
    routers: ['CloudWatchLogsRouter'],
    path: 'service-examples/cloudwatch',
  },
  {
    name: 'CodePipeline',
    icons: ['codepipeline'],
    summary: 'A release pipeline where two Lambdas share one router',
    routers: ['CodePipelineRouter'],
    path: 'service-examples/codepipeline',
  },
  {
    name: 'Cognito',
    icons: ['cognito'],
    summary: 'An applicant portal with two user pools on one worker',
    routers: ['CognitoRouter'],
    path: 'service-examples/cognito',
  },
  {
    name: 'Connect',
    icons: ['connect'],
    summary: 'A parcel support desk driven by a contact flow',
    routers: ['ConnectRouter'],
    path: 'service-examples/connect',
  },
  {
    name: 'DocumentDB',
    icons: ['documentdb'],
    summary: 'An online shop consuming seven change streams',
    routers: ['DocumentDBRouter'],
    path: 'service-examples/documentdb',
  },
  {
    name: 'DynamoDB',
    icons: ['dynamodb'],
    summary: 'An order service consuming two table streams',
    routers: ['DynamoDBRouter'],
    path: 'service-examples/dynamodb',
  },
  {
    name: 'EventBridge',
    icons: ['eventbridge'],
    summary: 'An order bus carrying four event sources on one rule',
    routers: ['EventBridgeRouter'],
    path: 'service-examples/eventbridge',
  },
  {
    name: 'Firehose',
    icons: ['firehose'],
    summary: 'Record transforms for a clickstream and an audit trail',
    routers: ['FirehoseRouter'],
    path: 'service-examples/firehose',
  },
  {
    name: 'Kafka',
    icons: ['msk'],
    summary: 'An order pipeline over three MSK topics',
    routers: ['KafkaRouter'],
    path: 'service-examples/kafka',
  },
  {
    name: 'Kinesis',
    icons: ['kinesis'],
    summary: 'An order and telemetry pipeline over two data streams',
    routers: ['KinesisRouter'],
    path: 'service-examples/kinesis',
  },
  {
    name: 'Lex',
    icons: ['lex'],
    summary: 'A parcel support bot with one code hook for every intent',
    routers: ['LexRouter'],
    path: 'service-examples/lex',
  },
  {
    name: 'MQ',
    icons: ['mq'],
    summary: 'An order and payment pipeline over two brokers',
    routers: ['ActiveMQRouter', 'RabbitMQRouter'],
    path: 'service-examples/mq',
  },
  {
    name: 'S3',
    icons: ['s3'],
    summary: 'A document vault over two buckets and a Batch job',
    routers: ['S3Router'],
    path: 'service-examples/s3',
  },
  {
    name: 'Secrets Manager',
    icons: ['secrets-manager'],
    summary: 'Credential rotation for five secrets',
    routers: ['SecretsManagerRouter'],
    path: 'service-examples/secretsmanager',
  },
  {
    name: 'SNS',
    icons: ['sns'],
    summary: 'Order fulfilment across three topics',
    routers: ['SNSRouter'],
    path: 'service-examples/sns',
  },
  {
    name: 'SQS',
    icons: ['sqs'],
    summary: 'A notifications dispatcher over a standard and a FIFO queue',
    routers: ['SQSRouter'],
    path: 'service-examples/sqs',
  },
  {
    name: 'Step Functions',
    icons: ['step-functions'],
    summary: 'An order workflow with ten parallel branches',
    routers: ['StepFunctionsRouter'],
    path: 'service-examples/stepfunctions',
  },
  {
    name: 'VPC Lattice',
    icons: ['vpc-lattice'],
    summary: 'An inventory service reached over a service network',
    routers: ['VPCLatticeRouter'],
    path: 'service-examples/vpclattice',
  },
];

export const fullExamples: ExampleEntry[] = [
  {
    name: 'HTTP API, DynamoDB and SQS',
    icons: ['api-gateway', 'dynamodb', 'sqs'],
    summary: 'An order fan-out chain across five handlers on two Lambdas',
    routers: ['APIGatewayRouter', 'DynamoDBRouter', 'SQSRouter'],
    path: 'full-examples/http-api-dynamodb-sqs',
  },
];
